/* eslint-disable import/order */
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppointmentStatus, ConsentType, UserRole } from '@srs/shared-types';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { CryptoService } from '../../../infrastructure/crypto/crypto.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { TreatmentPlansService } from './treatment-plans.service';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { StaffUpdateClientMedicalCardDto } from '../presentation/dto/staff-update-client-medical-card.dto';

type AvatarUploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

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
    const [user, latestQuiz] = await Promise.all([
      this.prisma.user.findUnique({
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
          specialistProfile: { select: { id: true } },
        },
      }),
      this.prisma.diagnosticQuizResponse.findFirst({
        where: { userId, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        select: {
          quizId: true,
          completedAt: true,
          totalScore: true,
          resultLevel: true,
          tagScores: true,
          outcome: { select: { id: true, title: true } },
        },
      }),
    ]);
    if (!user) throw new NotFoundException('Пользователь не найден');
    const { specialistProfile, ...userRest } = user;
    const tagScores = this.normalizeQuizTagScores(latestQuiz?.tagScores);
    return {
      ...userRest,
      specialistProfileId: specialistProfile?.id ?? null,
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
      diagnosticQuiz: latestQuiz
        ? {
            quizId: latestQuiz.quizId,
            completedAt: latestQuiz.completedAt!.toISOString(),
            resultLevel: latestQuiz.resultLevel,
            score: latestQuiz.totalScore,
            outcomeId: latestQuiz.outcome?.id ?? null,
            outcomeTitle: latestQuiz.outcome?.title ?? null,
            tagScores,
          }
        : null,
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

  async getMedicalCardBasicsForStaff(clientId: string, actor: JwtAccessPayload, appointmentId: string) {
    await this.assertUserIsClient(clientId);
    await this.assertAppointmentForClientStaff(actor, clientId, appointmentId);

    const [user, medicalCard] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: clientId },
        select: { birthDate: true },
      }),
      this.prisma.clientMedicalCard.findUnique({
        where: { userId: clientId },
        select: {
          dataEncrypted: true,
          dataIv: true,
          dataAuthTag: true,
          keyVersion: true,
        },
      }),
    ]);
    if (!user) throw new NotFoundException('Пользователь не найден');

    const parsed = this.parseMedicalCardPayload(medicalCard);
    return {
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
      allergies: parsed.allergies,
      chronicConditions: parsed.chronicConditions,
      contraindications: parsed.contraindications,
    };
  }

  async updateMedicalCardForStaff(clientId: string, actor: JwtAccessPayload, dto: StaffUpdateClientMedicalCardDto) {
    await this.assertUserIsClient(clientId);
    await this.assertAppointmentForClientStaff(actor, clientId, dto.appointmentId);

    const hasCardPatch =
      dto.allergies !== undefined || dto.chronicConditions !== undefined || dto.contraindications !== undefined;

    if (dto.birthDate !== undefined) {
      const birthNorm = this.parseOptionalBirthDate(dto.birthDate);
      await this.prisma.user.update({
        where: { id: clientId },
        data: { birthDate: birthNorm ?? null },
      });
    }

    if (hasCardPatch) {
      const existing = await this.prisma.clientMedicalCard.findUnique({
        where: { userId: clientId },
        select: {
          dataEncrypted: true,
          dataIv: true,
          dataAuthTag: true,
          keyVersion: true,
        },
      });
      const record = this.decryptMedicalCardRecord(existing);
      this.applyMedicalCardTextPatch(record, 'allergies', dto.allergies);
      this.applyMedicalCardTextPatch(record, 'chronicConditions', dto.chronicConditions);
      this.applyMedicalCardTextPatch(record, 'contraindications', dto.contraindications);
      const plain = JSON.stringify(record);
      const encrypted = this.cryptoService.encrypt(plain);
      await this.prisma.clientMedicalCard.upsert({
        where: { userId: clientId },
        create: {
          userId: clientId,
          dataEncrypted: Uint8Array.from(encrypted.cipherText),
          dataIv: Uint8Array.from(encrypted.iv),
          dataAuthTag: Uint8Array.from(encrypted.authTag),
          keyVersion: encrypted.keyVersion,
        },
        update: {
          dataEncrypted: Uint8Array.from(encrypted.cipherText),
          dataIv: Uint8Array.from(encrypted.iv),
          dataAuthTag: Uint8Array.from(encrypted.authTag),
          keyVersion: encrypted.keyVersion,
        },
      });
    }

    return this.getMedicalCardBasicsForStaff(clientId, actor, dto.appointmentId);
  }

  async getTreatmentPlans(userId: string) {
    return this.treatmentPlansService.listForMe(userId);
  }

  private async assertUserIsClient(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user || user.role !== UserRole.Client) {
      throw new NotFoundException('Клиент не найден');
    }
  }

  private async assertAppointmentForClientStaff(
    actor: JwtAccessPayload,
    clientId: string,
    appointmentId: string,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { studioId: true, clientUserId: true },
    });
    if (!appointment || appointment.clientUserId !== clientId) {
      throw new NotFoundException('Запись не найдена');
    }
    await this.assertStaffCanManageStudio(actor, appointment.studioId);
  }

  private async assertStaffCanManageStudio(actor: JwtAccessPayload, studioId: string): Promise<void> {
    if (actor.role === UserRole.SuperAdmin) return;
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, networkId: true },
    });
    if (!studio) throw new NotFoundException('Студия не найдена');

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: {
        studioId: true,
        studio: { select: { networkId: true } },
        specialistProfile: {
          select: {
            studioId: true,
            studios: { select: { studioId: true } },
          },
        },
      },
    });
    if (!actorUser) throw new ForbiddenException('Пользователь не найден');

    if (actor.role === UserRole.NetworkOwner) {
      if (actorUser.studio?.networkId !== studio.networkId) {
        throw new ForbiddenException('Нет доступа к этой сети');
      }
      return;
    }
    if (actor.role === UserRole.StudioAdmin) {
      if (actorUser.studioId !== studio.id) {
        throw new ForbiddenException('Нет доступа к этой студии');
      }
      return;
    }
    if (actor.role === UserRole.Specialist) {
      const profile = actorUser.specialistProfile;
      if (!profile) throw new ForbiddenException('Профиль специалиста не найден');
      const canAccess = profile.studioId === studio.id || profile.studios.some((item) => item.studioId === studio.id);
      if (!canAccess) {
        throw new ForbiddenException('Специалист не работает в этой студии');
      }
      return;
    }
    throw new ForbiddenException('Недостаточно прав');
  }

  private decryptMedicalCardRecord(input: {
    dataEncrypted: Uint8Array | null;
    dataIv: Uint8Array | null;
    dataAuthTag: Uint8Array | null;
    keyVersion: number;
  } | null): Record<string, unknown> {
    if (!input?.dataEncrypted || !input.dataIv || !input.dataAuthTag) {
      return {};
    }
    try {
      const plain = this.cryptoService.decrypt({
        cipherText: Buffer.from(input.dataEncrypted),
        iv: Buffer.from(input.dataIv),
        authTag: Buffer.from(input.dataAuthTag),
        keyVersion: input.keyVersion,
      });
      const parsed: unknown = JSON.parse(plain);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {};
      }
      return { ...(parsed as Record<string, unknown>) };
    } catch {
      return {};
    }
  }

  private applyMedicalCardTextPatch(record: Record<string, unknown>, key: string, value: string | undefined) {
    if (value === undefined) return;
    const t = value.trim();
    if (t === '') {
      delete record[key];
      return;
    }
    record[key] = t;
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

  /** Только числовые значения тегов для клиентского контракта. */
  private normalizeQuizTagScores(raw: unknown): Record<string, number> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      const k = key.trim();
      if (k !== '') out[k] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
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

  async uploadAvatar(userId: string, file: AvatarUploadFile | undefined, publicBaseUrl: string) {
    if (!file) {
      throw new BadRequestException('Файл изображения обязателен');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Можно загрузить только изображение');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Пустой файл изображения');
    }
    if (file.size > 3 * 1024 * 1024) {
      throw new BadRequestException('Изображение должно быть не больше 3 МБ');
    }

    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const filename = `${randomUUID()}${safeExt}`;
    const relativePath = `avatars/${userId}/${filename}`;
    const uploadsRoot = join(process.cwd(), 'uploads');
    const targetDir = join(uploadsRoot, 'avatars', userId);
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, filename), file.buffer);

    const url = `${publicBaseUrl.replace(/\/$/, '')}/uploads/${relativePath}`;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
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
  }
}

