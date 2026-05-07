/* eslint-disable import/order */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppointmentStatus, ConsentType } from '@srs/shared-types';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { CryptoService } from '../../../infrastructure/crypto/crypto.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { TreatmentPlansService } from './treatment-plans.service';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly treatmentPlansService: TreatmentPlansService,
  ) {}

  private consentTitleRu(type: ConsentType): string {
    switch (type) {
      case ConsentType.PersonalData:
        return 'Согласие на обработку персональных данных';
      case ConsentType.MedicalInformation:
        return 'Информированное согласие на медицинское вмешательство';
      case ConsentType.ProcedureConsent:
        return 'Согласие на медицинское вмешательство';
      case ConsentType.MarketingCommunications:
        return 'Согласие на маркетинговые коммуникации';
      case ConsentType.TermsOfService:
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
      const t = row.type as unknown as ConsentType;
      if (!latestByType.has(t)) {
        latestByType.set(t, row);
      }
    }
    return [...latestByType.values()].map((row) => ({
      id: row.id,
      type: row.type as unknown as ConsentType,
      documentVersion: row.documentVersion,
      signedAt: row.signedAt.toISOString(),
      title: this.consentTitleRu(row.type as unknown as ConsentType),
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

  async getMedicalCard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        birthDate: true,
      },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const [medicalCard, visits, latestPlan] = await Promise.all([
      this.prisma.clientMedicalCard.findUnique({
        where: { userId },
        select: {
          dataEncrypted: true,
          dataIv: true,
          dataAuthTag: true,
          keyVersion: true,
          updatedAt: true,
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          clientUserId: userId,
          status: {
            notIn: [AppointmentStatus.CancelledByClient, AppointmentStatus.CancelledByStudio],
          },
        },
        orderBy: [{ startsAt: 'desc' }],
        take: 20,
        select: {
          id: true,
          startsAt: true,
          specialistNote: true,
          service: {
            select: {
              name: true,
            },
          },
          specialist: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          protocol: {
            select: {
              diagnosis: true,
              proceduresDone: true,
              clientVisible: true,
            },
          },
        },
      }),
      this.prisma.treatmentPlan.findFirst({
        where: {
          clientUserId: userId,
          status: 'ACTIVE',
        },
        orderBy: [{ validFrom: 'desc' }],
        select: {
          validFrom: true,
          steps: true,
          author: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    const cardData = this.parseMedicalCardPayload(medicalCard);
    const planSteps = this.parseTreatmentSteps(latestPlan?.steps);
    const specialistName = latestPlan
      ? `${latestPlan.author.firstName} ${latestPlan.author.lastName}`.trim()
      : null;

    const history = visits.map((visit) => {
      const diagnosis =
        visit.protocol && visit.protocol.clientVisible ? (visit.protocol.diagnosis?.trim() ?? null) : null;
      const actions =
        visit.protocol && visit.protocol.clientVisible
          ? visit.protocol.proceduresDone.filter((item) => item.trim() !== '')
          : [];
      const summary = diagnosis ?? visit.specialistNote?.trim() ?? null;
      return {
        id: visit.id,
        startsAt: visit.startsAt.toISOString(),
        specialistName: `${visit.specialist.user.firstName} ${visit.specialist.user.lastName}`.trim(),
        specialistRole: 'Подолог',
        serviceLabel: visit.service.name,
        summary,
        diagnosis,
        actions,
        recommendations: visit.specialistNote?.trim() ?? null,
      };
    });

    return {
      basics: {
        birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
        allergies: cardData.allergies,
        chronicConditions: cardData.chronicConditions,
        contraindications: cardData.contraindications,
      },
      specialist: {
        contraindications: cardData.contraindications,
        plan: planSteps,
        recommendations: history[0]?.recommendations ?? null,
        filledAt: latestPlan?.validFrom ? latestPlan.validFrom.toISOString() : null,
        specialistName,
        specialistRole: specialistName ? 'Ведущий подолог' : null,
      },
      history,
    };
  }

  async getTreatmentPlans(userId: string) {
    return this.treatmentPlansService.listForMe(userId);
  }

  private parseMedicalCardPayload(input: {
    dataEncrypted: Uint8Array | null;
    dataIv: Uint8Array | null;
    dataAuthTag: Uint8Array | null;
    keyVersion: number;
  } | null): {
    allergies: string | null;
    chronicConditions: string | null;
    contraindications: string | null;
  } {
    if (!input?.dataEncrypted || !input.dataIv || !input.dataAuthTag) {
      return {
        allergies: null,
        chronicConditions: null,
        contraindications: null,
      };
    }
    try {
      const plain = this.cryptoService.decrypt({
        cipherText: Buffer.from(input.dataEncrypted),
        iv: Buffer.from(input.dataIv),
        authTag: Buffer.from(input.dataAuthTag),
        keyVersion: input.keyVersion,
      });
      const parsed = JSON.parse(plain) as {
        allergies?: unknown;
        chronicConditions?: unknown;
        contraindications?: unknown;
      };
      return {
        allergies: this.pickString(parsed.allergies),
        chronicConditions: this.pickString(parsed.chronicConditions),
        contraindications: this.pickString(parsed.contraindications),
      };
    } catch {
      return {
        allergies: null,
        chronicConditions: null,
        contraindications: null,
      };
    }
  }

  private parseTreatmentSteps(raw: Prisma.JsonValue | null | undefined): string[] {
    if (!Array.isArray(raw)) return [];
    const items: string[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const text = this.pickString((item as Record<string, unknown>).text);
      if (text) items.push(text);
    }
    return items;
  }

  private pickString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const next = value.trim();
    return next === '' ? null : next;
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
    if (!/^https?:\/\//i.test(t)) {
      throw new BadRequestException(
        'Аватар: укажите https-ссылку. Для загрузки файла используйте POST /me/avatar.',
      );
    }
    if (t.length > 2000) {
      throw new BadRequestException('URL аватара слишком длинный');
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

