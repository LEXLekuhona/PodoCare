import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConsentType, Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  private consentTitleRu(type: ConsentType): string {
    switch (type) {
      case ConsentType.PERSONAL_DATA:
        return 'Согласие на обработку персональных данных';
      case ConsentType.MEDICAL_INFORMATION:
        return 'Информированное согласие на медицинское вмешательство';
      case ConsentType.PROCEDURE_CONSENT:
        return 'Согласие на медицинское вмешательство';
      case ConsentType.MARKETING_COMMUNICATIONS:
        return 'Согласие на маркетинговые коммуникации';
      case ConsentType.TERMS_OF_SERVICE:
        return 'Условия использования сервиса';
      default:
        return 'Документ';
    }
  }

  async listConsents(userId: string) {
    const rows = await this.prisma.consent.findMany({
      where: { userId, accepted: true, revokedAt: null },
      orderBy: { signedAt: 'desc' },
      select: { id: true, type: true, documentVersion: true, signedAt: true },
    });
    const latestByType = new Map<ConsentType, (typeof rows)[0]>();
    for (const row of rows) {
      if (!latestByType.has(row.type)) {
        latestByType.set(row.type, row);
      }
    }
    return [...latestByType.values()].map((row) => ({
      id: row.id,
      type: row.type,
      documentVersion: row.documentVersion,
      signedAt: row.signedAt.toISOString(),
      title: this.consentTitleRu(row.type),
      status: 'ACTIVE' as const,
    }));
  }

  async recordConsents(userId: string, items: { type: ConsentType; documentVersion: string }[]) {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.consent.create({
          data: {
            userId,
            type: item.type,
            documentVersion: item.documentVersion,
            accepted: true,
            signedAt: new Date(),
          },
        }),
      ),
    );
    return this.listConsents(userId);
  }

  async get(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        avatarUrl: true,
      },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return {
      ...user,
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    };
  }

  private normalizeOptionalEmail(raw: string | undefined): string | null | undefined {
    if (raw === undefined) return undefined;
    const t = raw.trim();
    if (t === '') return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      throw new BadRequestException('Некорректный email');
    }
    return t.toLowerCase();
  }

  private parseOptionalBirthDate(raw: string | undefined): Date | null | undefined {
    if (raw === undefined) return undefined;
    const s = raw.trim();
    if (s === '') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) {
      throw new BadRequestException('Дата рождения ожидается в формате YYYY-MM-DD');
    }
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    const d = new Date(Date.UTC(y, mo - 1, da));
    if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== da) {
      throw new BadRequestException('Некорректная дата рождения');
    }
    return d;
  }

  private normalizeOptionalAvatarUrl(raw: string | undefined): string | null | undefined {
    if (raw === undefined) return undefined;
    const t = raw.trim();
    if (t === '') return null;
    if (t.length > 600000) {
      throw new BadRequestException('Слишком большое изображение');
    }
    const isHttp = /^https?:\/\//i.test(t);
    const dataMatch = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/is.exec(t);
    const isData = Boolean(dataMatch);
    if (!isHttp && !isData) {
      throw new BadRequestException('Аватар: укажите http(s)-ссылку или data URI изображения (jpeg/png/webp)');
    }
    if (isData && dataMatch) {
      const b64 = dataMatch[2]?.replace(/\s/g, '') ?? '';
      if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
        throw new BadRequestException('Некорректные данные изображения');
      }
    }
    return t;
  }

  async update(
    userId: string,
    input: {
      firstName?: string;
      lastName?: string;
      email?: string;
      birthDate?: string;
      avatarUrl?: string;
    },
  ) {
    const emailNorm = this.normalizeOptionalEmail(input.email);
    const birthNorm = this.parseOptionalBirthDate(input.birthDate);
    const avatarNorm = this.normalizeOptionalAvatarUrl(input.avatarUrl);

    const data: Prisma.UserUpdateInput = {};
    if (input.firstName !== undefined) data.firstName = input.firstName.trim();
    if (input.lastName !== undefined) data.lastName = input.lastName.trim();
    if (emailNorm !== undefined) data.email = emailNorm;
    if (birthNorm !== undefined) data.birthDate = birthNorm;
    if (avatarNorm !== undefined) data.avatarUrl = avatarNorm;

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          role: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          avatarUrl: true,
        },
      });
      return {
        ...updated,
        birthDate: updated.birthDate ? updated.birthDate.toISOString().slice(0, 10) : null,
      };
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = e.meta?.target;
        const keys = Array.isArray(target) ? target.map(String) : target ? [String(target)] : [];
        if (keys.some((k) => k.includes('email'))) {
          throw new ConflictException('Этот email уже занят');
        }
        throw new ConflictException('Конфликт уникальности данных');
      }
      throw e;
    }
  }
}

