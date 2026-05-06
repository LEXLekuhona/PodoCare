import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@srs/shared-types';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { JwtConfig } from '../../../config/jwt.config';

export interface JwtAccessPayload {
  sub: string;
  sessionId: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtConfig = configService.getOrThrow<JwtConfig>('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessSecret,
    });
  }

  async validate(payload: JwtAccessPayload) {
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      select: { revokedAt: true, expiresAt: true, user: { select: { isActive: true } } },
    });
    if (!session || session.revokedAt !== null || !session.user.isActive) {
      throw new UnauthorizedException('Сессия недействительна');
    }
    return payload;
  }
}