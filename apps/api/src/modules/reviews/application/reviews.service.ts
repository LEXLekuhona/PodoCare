/* eslint-disable import/order */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';


// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { CreateReviewDto, ReviewRatingsDto } from '../presentation/dto/create-review.dto';
import type { Prisma } from '@prisma/client';

const REVIEW_SELECT = {
  id: true,
  userId: true,
  studioId: true,
  appointmentId: true,
  ratings: true,
  comment: true,
  allowPublish: true,
  createdAt: true,
} satisfies Prisma.FeedbackSurveySelect;

type ReviewRow = Prisma.FeedbackSurveyGetPayload<{ select: typeof REVIEW_SELECT }>;

/**
 * Сервис отзывов клиента о визите/студии. Хранит данные в FeedbackSurvey,
 * чтобы не плодить новые таблицы — у модели уже есть нужные поля.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForClient(userId: string, dto: CreateReviewDto) {
    const comment = this.normalizeComment(dto.comment);
    const ratings = this.normalizeRatings(dto.ratings);

    if (!comment && !ratings) {
      throw new BadRequestException('Отзыв пустой: укажите текст или оценки');
    }

    const studioId = await this.resolveStudioId(userId, dto);

    const created = await this.prisma.feedbackSurvey.create({
      data: {
        userId,
        studioId,
        appointmentId: dto.appointmentId ?? null,
        ratings: ratings ?? ({} as Prisma.JsonObject),
        comment: comment ?? null,
        allowPublish: dto.allowPublish ?? false,
      },
      select: REVIEW_SELECT,
    });

    return this.toDto(created);
  }

  async listMine(userId: string) {
    const rows = await this.prisma.feedbackSurvey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: REVIEW_SELECT,
      take: 50,
    });
    return rows.map((row) => this.toDto(row));
  }

  /**
   * Студию можно не передавать с клиента: сначала пробуем взять из
   * appointmentId (с проверкой владельца записи), затем из user.studioId.
   */
  private async resolveStudioId(userId: string, dto: CreateReviewDto): Promise<string> {
    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: dto.appointmentId },
        select: { studioId: true, clientUserId: true },
      });
      if (!appointment) {
        throw new NotFoundException('Запись не найдена');
      }
      if (appointment.clientUserId !== userId) {
        throw new ForbiddenException('Нельзя оставить отзыв за чужой визит');
      }
      if (dto.studioId && dto.studioId !== appointment.studioId) {
        throw new BadRequestException('studioId не совпадает с визитом');
      }
      return appointment.studioId;
    }

    if (dto.studioId) {
      const studio = await this.prisma.studio.findUnique({
        where: { id: dto.studioId },
        select: { id: true },
      });
      if (!studio) {
        throw new NotFoundException('Студия не найдена');
      }
      return studio.id;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { studioId: true },
    });
    if (!user?.studioId) {
      throw new BadRequestException(
        'Не удалось определить студию для отзыва. Укажите studioId или appointmentId.',
      );
    }
    return user.studioId;
  }

  private normalizeComment(input: string | undefined): string | null {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (trimmed.length < 8) return null;
    return trimmed;
  }

  private normalizeRatings(input: ReviewRatingsDto | undefined): Prisma.JsonObject | null {
    if (!input) return null;
    const out: Prisma.JsonObject = {};
    for (const key of ['overall', 'specialist', 'studio', 'service'] as const) {
      const v = input[key];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5) {
        out[key] = v;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  private toDto(row: ReviewRow) {
    return {
      id: row.id,
      userId: row.userId,
      studioId: row.studioId,
      appointmentId: row.appointmentId,
      ratings: this.parseRatings(row.ratings),
      comment: row.comment,
      allowPublish: row.allowPublish,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private parseRatings(raw: Prisma.JsonValue): Record<string, number> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Prisma.JsonObject;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5) {
        out[k] = v;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }
}
