import { randomInt } from 'node:crypto';

import { normalizePhone } from '../../../common/utils/normalize-phone';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { OtpCode, User } from '@prisma/client';
import argon2 from 'argon2';
import { UserRole } from '@srs/shared-types';

import type { JwtConfig } from '../../../config/jwt.config';
import { CryptoService } from '../../../infrastructure/crypto/crypto.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RequestOtpDto } from '../presentation/dto/request-otp.dto';
import { StaffLoginDto } from '../presentation/dto/staff-login.dto';
import { VerifyOtpDto } from '../presentation/dto/verify-otp.dto';

interface JwtBasePayload {
  sub: string;
  sessionId: string;
  role: UserRole;
}

interface JwtRefreshPayload extends JwtBasePayload {
  type: 'refresh';
  tokenId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    role: UserRole;
    phone: string;
    email: string | null;
    firstName: string;
    lastName: string;
  };
  tokens: TokenPair;
}

export interface RequestOtpResponse {
  expiresAt: string;
  resendAvailableAt: string;
  /** Длина кода на клиенте (из OTP_CODE_LENGTH), чтобы UI не ждал лишние символы. */
  codeLength: number;
  debugCode?: string;
}

@Injectable()
export class AuthService {
  private readonly otpCodeLength: number;
  private readonly otpTtlSeconds: number;
  private readonly otpMaxAttempts: number;
  private readonly otpResendCooldownSeconds: number;
  private readonly otpProvider: string;
  private readonly nodeEnv: string;
  private readonly jwtConfig: JwtConfig;
  private readonly accessExpiresSeconds: number;
  private readonly refreshExpiresSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
  ) {
    this.otpCodeLength = this.configService.get<number>('OTP_CODE_LENGTH', 6);
    this.otpTtlSeconds = this.configService.get<number>('OTP_TTL_SECONDS', 300);
    this.otpMaxAttempts = this.configService.get<number>('OTP_MAX_ATTEMPTS', 5);
    this.otpResendCooldownSeconds = this.configService.get<number>(
      'OTP_RESEND_COOLDOWN_SECONDS',
      60,
    );
    this.otpProvider = this.configService.get<string>('OTP_PROVIDER', 'console');
    this.nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    this.jwtConfig = this.configService.getOrThrow<JwtConfig>('jwt');
    this.accessExpiresSeconds = this.parseDurationToSeconds(this.jwtConfig.accessExpires);
    this.refreshExpiresSeconds = this.parseDurationToSeconds(this.jwtConfig.refreshExpires);
  }

  async requestOtp(input: RequestOtpDto): Promise<RequestOtpResponse> {
    const normalizedPhone = normalizePhone(input.phone);
    const latestOtp = await this.prisma.otpCode.findFirst({
      where: { phone: normalizedPhone },
      orderBy: { createdAt: 'desc' },
    });

    if (latestOtp) {
      this.ensureResendAllowed(latestOtp);
    }

    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + this.otpTtlSeconds * 1000);
    const resendAvailableAt = new Date(Date.now() + this.otpResendCooldownSeconds * 1000);
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    await this.prisma.otpCode.create({
      data: {
        phone: normalizedPhone,
        userId: existingUser?.id,
        codeHash: this.cryptoService.hashSha256(this.getOtpHashPayload(normalizedPhone, code)),
        maxAttempts: this.otpMaxAttempts,
        expiresAt,
      },
    });

    await this.sendOtpSafe(normalizedPhone, code);

    return {
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
      codeLength: this.otpCodeLength,
      ...(this.shouldExposeDebugCode() ? { debugCode: code } : {}),
    };
  }

  async verifyOtp(input: VerifyOtpDto): Promise<AuthResponse> {
    const normalizedPhone = normalizePhone(input.phone);
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone: normalizedPhone },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('OTP код не найден');
    }
    if (otp.usedAt) {
      throw new UnauthorizedException('OTP код уже использован');
    }
    if (otp.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('OTP код истёк');
    }
    if (otp.attempts >= otp.maxAttempts) {
      throw new UnauthorizedException('Превышено количество попыток');
    }

    const expectedHash = this.cryptoService.hashSha256(
      this.getOtpHashPayload(normalizedPhone, input.code),
    );
    if (!this.cryptoService.timingSafeCompare(expectedHash, otp.codeHash)) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Неверный OTP код');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.otpCode.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });

      const existingUser = await tx.user.findUnique({ where: { phone: normalizedPhone } });
      if (existingUser) {
        return tx.user.update({
          where: { id: existingUser.id },
          data: {
            phoneVerifiedAt: existingUser.phoneVerifiedAt ?? new Date(),
            lastLoginAt: new Date(),
          },
        });
      }

      const firstName = this.getDefaultName(input.firstName, 'Новый');
      const lastName = this.getDefaultName(input.lastName, 'Клиент');
      return tx.user.create({
        data: {
          role: UserRole.Client,
          phone: normalizedPhone,
          phoneVerifiedAt: new Date(),
          firstName,
          lastName,
          locale: 'ru',
        },
      });
    });

    const tokens = await this.createSessionAndSignTokens({
      userId: user.id,
      role: user.role as UserRole,
      deviceType: input.deviceType,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    return this.buildAuthResponse(user, tokens);
  }

  async loginStaff(input: StaffLoginDto): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash || user.role === UserRole.Client || !user.isActive) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.createSessionAndSignTokens({
      userId: updated.id,
      role: updated.role as UserRole,
      deviceType: input.deviceType,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    return this.buildAuthResponse(updated, tokens);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException('Сессия недействительна');
    }

    const tokenHash = this.cryptoService.hashSha256(refreshToken);
    if (tokenHash !== session.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token недействителен');
    }

    const nextTokens = await this.signTokens({
      userId: session.user.id,
      role: session.user.role as UserRole,
      sessionId: session.id,
    });

    const nextRefreshPayload = this.decodeJwt(nextTokens.refreshToken);
    const nextExpiresAt = this.resolveJwtExpiry(nextRefreshPayload);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.cryptoService.hashSha256(nextTokens.refreshToken),
        expiresAt: nextExpiresAt,
      },
    });

    return nextTokens;
  }

  async logout(refreshToken: string): Promise<void> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }

    await this.prisma.authSession.updateMany({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private async createSessionAndSignTokens(input: {
    userId: string;
    role: UserRole;
    deviceType: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<TokenPair> {
    const sessionId = globalThis.crypto.randomUUID();
    const tokens = await this.signTokens({
      userId: input.userId,
      role: input.role,
      sessionId,
    });
    const refreshPayload = this.decodeJwt(tokens.refreshToken);
    const expiresAt = this.resolveJwtExpiry(refreshPayload);

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: input.userId,
        refreshTokenHash: this.cryptoService.hashSha256(tokens.refreshToken),
        deviceType: input.deviceType,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        expiresAt,
      },
    });

    return tokens;
  }

  private async signTokens(input: {
    userId: string;
    role: UserRole;
    sessionId: string;
  }): Promise<TokenPair> {
    const basePayload: JwtBasePayload = {
      sub: input.userId,
      sessionId: input.sessionId,
      role: input.role,
    };

    const accessToken = await this.jwtService.signAsync(basePayload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.accessExpiresSeconds,
    });
    const refreshToken = await this.jwtService.signAsync(
      {
        ...basePayload,
        type: 'refresh' satisfies JwtRefreshPayload['type'],
        tokenId: globalThis.crypto.randomUUID(),
      },
      {
        secret: this.jwtConfig.refreshSecret,
        expiresIn: this.refreshExpiresSeconds,
      },
    );

    return { accessToken, refreshToken };
  }

  private decodeJwt(token: string): { exp?: number } {
    const payload = this.jwtService.decode(token);
    if (!payload || typeof payload !== 'object') {
      throw new UnauthorizedException('Некорректный JWT payload');
    }
    return payload as { exp?: number };
  }

  private resolveJwtExpiry(payload: { exp?: number }): Date {
    if (!payload.exp) {
      throw new UnauthorizedException('В refresh token отсутствует exp');
    }
    return new Date(payload.exp * 1000);
  }

  private async verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
    const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(token, {
      secret: this.jwtConfig.refreshSecret,
    });
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Некорректный тип токена');
    }
    return payload;
  }

  private buildAuthResponse(user: User, tokens: TokenPair): AuthResponse {
    return {
      user: {
        id: user.id,
        role: user.role as UserRole,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tokens,
    };
  }

  private ensureResendAllowed(otp: OtpCode): void {
    if (otp.usedAt) {
      return;
    }
    const elapsedMs = Date.now() - otp.createdAt.getTime();
    const cooldownMs = this.otpResendCooldownSeconds * 1000;
    if (elapsedMs < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      throw new BadRequestException(
        `Повторная отправка будет доступна через ${waitSeconds} сек.`,
      );
    }
  }

  private generateOtpCode(): string {
    const min = 10 ** (this.otpCodeLength - 1);
    const max = 10 ** this.otpCodeLength;
    return String(randomInt(min, max));
  }

  private getOtpHashPayload(phone: string, code: string): string {
    return `${phone}:${code}`;
  }
  private async sendOtpSafe(phone: string, code: string): Promise<void> {
    try {
      this.sendOtp(phone, code);
    } catch (err) {
      // Не падаем — OTP уже создан в БД. Логируем для алертов.
      console.error(`[OTP] Failed to send to ${phone}:`, err);
    }
  }
  
  private sendOtp(phone: string, code: string): void {
    if (this.otpProvider === 'console' || this.nodeEnv !== 'production') {
      console.log(`[OTP] ${phone}: ${code}`);
      return;
    }
    console.warn(
      `OTP provider "${this.otpProvider}" не подключен. Код отправлен в console fallback.`,
    );
    console.log(`[OTP] ${phone}: ${code}`);
  }


  private shouldExposeDebugCode(): boolean {
    return this.nodeEnv !== 'production' || this.otpProvider === 'console';
  }

  private getDefaultName(value: string | undefined, fallback: string): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      return fallback;
    }
    return trimmed.slice(0, 100);
  }

  private parseDurationToSeconds(value: string): number {
    const trimmed = value.trim().toLowerCase();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
    const match = /^(\d+)([smhd])$/.exec(trimmed);
    if (!match) {
      throw new Error(
        `Некорректный формат длительности "${value}". Используй числа или суффиксы s/m/h/d.`,
      );
    }
    const amount = Number(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 60 * 60;
      case 'd':
        return amount * 60 * 60 * 24;
      default:
        throw new Error(`Неподдерживаемая единица времени: ${unit}`);
    }
  }
}
