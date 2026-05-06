import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  UserRole,
} from '@srs/shared-types';
import {
  ContentAudience,
  ContentCtaTarget,
  FunnelEventType,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  OrderStatus,
  Prisma,
  PushProvider,
} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { PushDeliveryService } from '../../notifications/infrastructure/push/push-delivery.service';
import { resolvePaywallMode } from './content-funnel.policy';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';
import type { CreateClientContentProgressDto } from '../presentation/dto/create-client-content-progress.dto';
import type { CreateContentCtaDto } from '../presentation/dto/create-content-cta.dto';
import type { CreateContentItemDto } from '../presentation/dto/create-content-item.dto';
import type { CreateContentSeriesDto } from '../presentation/dto/create-content-series.dto';
import type { ListContentSeriesQueryDto } from '../presentation/dto/list-content-series.query.dto';
import type { UpdateContentCtaDto } from '../presentation/dto/update-content-cta.dto';
import type { UpdateContentItemDto } from '../presentation/dto/update-content-item.dto';
import type { UpdateContentSeriesDto } from '../presentation/dto/update-content-series.dto';

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function slugBaseFromTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return base.length > 0 ? base : 'content';
}

function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushDelivery: PushDeliveryService,
  ) {}

  async feed(userId?: string) {
    return this.getClientFeed(userId);
  }

  async createSeries(user: JwtAccessPayload, dto: CreateContentSeriesDto) {
    await this.assertAdminNetworkAccess(user, dto.networkId);
    const slug = dto.slug?.trim() ?? `${slugBaseFromTitle(dto.title)}-${uniqueSuffix()}`;
    const isPublished = dto.status === 'published';

    try {
      return await this.prisma.contentSeries.create({
        data: {
          networkId: dto.networkId,
          authorUserId: user.sub,
          slug,
          title: dto.title,
          subtitle: dto.subtitle,
          description: dto.description,
          coverImageUrl: dto.coverImageUrl,
          audience: dto.audience,
          tags: dto.tags ?? [],
          priceMinor: dto.priceMinor ?? 0,
          currency: dto.currency ?? 'RUB',
          sortOrder: dto.sortOrder ?? 0,
          isPublished,
          publishedAt: isPublished ? new Date() : null,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Серия с таким slug уже существует');
      }
      throw e;
    }
  }

  async listSeries(user: JwtAccessPayload, q: ListContentSeriesQueryDto) {
    const scopedNetworkId = await this.resolveScopedNetworkId(user, q.networkId);
    const where: Prisma.ContentSeriesWhereInput = {};
    if (scopedNetworkId) where.networkId = scopedNetworkId;
    if (q.audience !== undefined) where.audience = q.audience;
    if (q.status === 'published') where.isPublished = true;
    if (q.status === 'draft') where.isPublished = false;
    const [items, total] = await Promise.all([
      this.prisma.contentSeries.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: q.skip,
        take: q.take,
      }),
      this.prisma.contentSeries.count({ where }),
    ]);
    return { items, total, skip: q.skip, take: q.take };
  }

  async updateSeries(user: JwtAccessPayload, id: string, dto: UpdateContentSeriesDto) {
    const existing = await this.prisma.contentSeries.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Серия не найдена');
    await this.assertAdminNetworkAccess(user, existing.networkId);
    const isPublished = dto.status === 'published' ? true : dto.status === 'draft' ? false : undefined;

    try {
      return await this.prisma.contentSeries.update({
        where: { id },
        data: {
          ...(dto.slug !== undefined && { slug: dto.slug.trim() }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
          ...(dto.audience !== undefined && { audience: dto.audience }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.priceMinor !== undefined && { priceMinor: dto.priceMinor }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(isPublished !== undefined && { isPublished }),
          ...(isPublished === true && !existing.publishedAt ? { publishedAt: new Date() } : {}),
          ...(isPublished === false ? { publishedAt: null } : {}),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Серия с таким slug уже существует');
      }
      throw e;
    }
  }

  async createItem(user: JwtAccessPayload, dto: CreateContentItemDto) {
    await this.assertAdminNetworkAccess(user, dto.networkId);
    const series = await this.prisma.contentSeries.findUnique({ where: { id: dto.seriesId } });
    if (!series) throw new NotFoundException('Серия не найдена');
    if (series.networkId !== dto.networkId) {
      throw new ConflictException('Серия принадлежит другой сети');
    }
    const slug = dto.slug?.trim() ?? `${slugBaseFromTitle(dto.title)}-${uniqueSuffix()}`;
    const isPublished = dto.status === 'published';
    try {
      return await this.prisma.contentItem.create({
        data: {
          networkId: dto.networkId,
          seriesId: dto.seriesId,
          authorUserId: user.sub,
          slug,
          title: dto.title,
          description: dto.description,
          format: dto.format,
          audience: dto.audience ?? series.audience,
          body: dto.body,
          coverImageUrl: dto.coverImageUrl,
          durationSeconds: dto.durationSeconds,
          sortOrder: dto.sortOrder ?? 0,
          isFreePreview: dto.isFreePreview ?? false,
          tags: dto.tags ?? [],
          isPublished,
          publishedAt: isPublished ? new Date() : null,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Материал с таким slug уже существует');
      }
      throw e;
    }
  }

  async updateItem(user: JwtAccessPayload, id: string, dto: UpdateContentItemDto) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Материал не найден');
    await this.assertAdminNetworkAccess(user, existing.networkId);
    const isPublished = dto.status === 'published' ? true : dto.status === 'draft' ? false : undefined;
    try {
      return await this.prisma.contentItem.update({
        where: { id },
        data: {
          ...(dto.slug !== undefined && { slug: dto.slug.trim() }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.format !== undefined && { format: dto.format }),
          ...(dto.audience !== undefined && { audience: dto.audience }),
          ...(dto.body !== undefined && { body: dto.body }),
          ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
          ...(dto.durationSeconds !== undefined && { durationSeconds: dto.durationSeconds }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isFreePreview !== undefined && { isFreePreview: dto.isFreePreview }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(isPublished !== undefined && { isPublished }),
          ...(isPublished === true && !existing.publishedAt ? { publishedAt: new Date() } : {}),
          ...(isPublished === false ? { publishedAt: null } : {}),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Материал с таким slug уже существует');
      }
      throw e;
    }
  }

  async publishItem(user: JwtAccessPayload, id: string) {
    const item = await this.prisma.contentItem.findUnique({
      where: { id },
      include: { series: true },
    });
    if (!item) throw new NotFoundException('Материал не найден');
    await this.assertAdminNetworkAccess(user, item.networkId);
    const published = await this.prisma.contentItem.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: item.publishedAt ?? new Date(),
      },
    });
    if (!item.series.isPublished) {
      await this.prisma.contentSeries.update({
        where: { id: item.seriesId },
        data: {
          isPublished: true,
          publishedAt: item.series.publishedAt ?? new Date(),
        },
      });
    }
    const pushes = await this.createNewContentPushNotifications(published.networkId, published.id, published.audience);
    return { item: published, pushQueued: pushes };
  }

  async createItemCta(user: JwtAccessPayload, itemId: string, dto: CreateContentCtaDto) {
    const item = await this.prisma.contentItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Материал не найден');
    await this.assertAdminNetworkAccess(user, item.networkId);
    this.validateCtaTarget(dto);
    return this.prisma.contentCta.create({
      data: {
        itemId,
        target: dto.target,
        label: dto.label,
        subtitle: dto.subtitle,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        targetProgramId: dto.targetProgramId,
        targetSeriesId: dto.targetSeriesId,
        targetServiceId: dto.targetServiceId,
        targetPhysicalGoodId: dto.targetPhysicalGoodId,
        targetQuizId: dto.targetQuizId,
        targetExternalUrl: dto.targetExternalUrl,
      },
    });
  }

  async updateItemCta(user: JwtAccessPayload, itemId: string, ctaId: string, dto: UpdateContentCtaDto) {
    const cta = await this.prisma.contentCta.findUnique({
      where: { id: ctaId },
      include: { item: true },
    });
    if (!cta || cta.itemId !== itemId || !cta.item) {
      throw new NotFoundException('CTA не найден');
    }
    await this.assertAdminNetworkAccess(user, cta.item.networkId);
    this.validateCtaTarget(dto);
    return this.prisma.contentCta.update({
      where: { id: ctaId },
      data: {
        ...(dto.target !== undefined && { target: dto.target }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.targetProgramId !== undefined && { targetProgramId: dto.targetProgramId }),
        ...(dto.targetSeriesId !== undefined && { targetSeriesId: dto.targetSeriesId }),
        ...(dto.targetServiceId !== undefined && { targetServiceId: dto.targetServiceId }),
        ...(dto.targetPhysicalGoodId !== undefined && { targetPhysicalGoodId: dto.targetPhysicalGoodId }),
        ...(dto.targetQuizId !== undefined && { targetQuizId: dto.targetQuizId }),
        ...(dto.targetExternalUrl !== undefined && { targetExternalUrl: dto.targetExternalUrl }),
      },
    });
  }

  async getClientFeed(userId?: string) {
    const paidSeriesIds = userId ? await this.getPaidSeriesIds(userId) : new Set<string>();
    const preferredTags = await this.getPreferredTagsFromLatestQuiz(userId);
    const progressRows = userId
      ? await this.prisma.contentItemProgress.findMany({
          where: { userId },
          select: { itemId: true, percent: true, completedAt: true },
        })
      : [];
    const progressByItemId = new Map(progressRows.map((x) => [x.itemId, x]));

    const items = await this.prisma.contentItem.findMany({
      where: {
        isPublished: true,
        audience: { in: [ContentAudience.CLIENT, ContentAudience.EVERYONE] },
        series: { isPublished: true },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        series: {
          select: {
            id: true,
            title: true,
            priceMinor: true,
            currency: true,
          },
        },
        ctas: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            target: true,
            label: true,
            subtitle: true,
            sortOrder: true,
            targetProgramId: true,
            targetSeriesId: true,
            targetServiceId: true,
            targetPhysicalGoodId: true,
            targetQuizId: true,
            targetExternalUrl: true,
          },
        },
      },
    });
    const ordered = items
      .map((item, index) => ({
        item,
        rank: this.feedRankByQuizTags(item.tags, preferredTags, index),
      }))
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.item);

    return {
      items: ordered.map((i) => {
        const isPaid = i.series.priceMinor > 0;
        const locked = isPaid && !i.isFreePreview && !paidSeriesIds.has(i.seriesId);
        const progress = progressByItemId.get(i.id);
        return {
          id: i.id,
          title: i.title,
          description: i.description,
          coverImageUrl: i.coverImageUrl,
          publishedAt: i.publishedAt ? i.publishedAt.toISOString() : null,
          format: i.format,
          seriesId: i.seriesId,
          audience: i.audience,
          paywall: {
            mode: resolvePaywallMode(i.series.priceMinor),
            isLocked: locked,
            priceMinor: i.series.priceMinor,
            currency: i.series.currency,
          },
          progress: {
            percent: progress?.percent ?? 0,
            completedAt: progress?.completedAt ? progress.completedAt.toISOString() : null,
          },
          ctas: i.ctas,
        };
      }),
    };
  }

  private async getPreferredTagsFromLatestQuiz(userId?: string): Promise<Set<string>> {
    if (!userId) return new Set<string>();
    const latest = await this.prisma.diagnosticQuizResponse.findFirst({
      where: { userId, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { tagScores: true },
    });
    if (!latest?.tagScores || typeof latest.tagScores !== 'object' || Array.isArray(latest.tagScores)) {
      return new Set<string>();
    }
    const tags = new Set<string>();
    for (const [tag, score] of Object.entries(latest.tagScores as Record<string, unknown>)) {
      if (typeof score !== 'number' || score <= 0) continue;
      const normalized = tag.trim().toLowerCase();
      if (normalized !== '') tags.add(normalized);
    }
    return tags;
  }

  private feedRankByQuizTags(tags: string[], preferred: Set<string>, fallbackIndex: number): number {
    if (preferred.size === 0) return fallbackIndex + 10_000;
    const normalized = tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    const hits = normalized.filter((tag) => preferred.has(tag)).length;
    if (hits === 0) return fallbackIndex + 10_000;
    return 100 - hits * 10 + fallbackIndex;
  }

  async saveClientProgress(userId: string, itemId: string, dto: CreateClientContentProgressDto) {
    const item = await this.assertClientCanAccessItem(userId, itemId);
    const percent = Math.max(0, Math.min(100, dto.percent));
    const existing = await this.prisma.contentItemProgress.findUnique({
      where: { userId_itemId: { userId, itemId } },
    });
    const completedNow = percent >= 100 && !existing?.completedAt;
    const progress = await this.prisma.contentItemProgress.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: {
        userId,
        itemId,
        percent,
        lastPositionSeconds: dto.lastPositionSeconds ?? null,
        completedAt: percent >= 100 ? new Date() : null,
      },
      update: {
        percent: Math.max(percent, existing?.percent ?? 0),
        ...(dto.lastPositionSeconds !== undefined && { lastPositionSeconds: dto.lastPositionSeconds }),
        ...(percent >= 100 && !existing?.completedAt ? { completedAt: new Date() } : {}),
      },
    });
    await this.prisma.funnelEvent.create({
      data: {
        userId,
        type: FunnelEventType.CONTENT_VIEWED,
        metadata: {
          entityType: 'content_item',
          entityId: item.id,
          itemId: item.id,
          seriesId: item.seriesId,
          percent,
        },
        source: 'mobile',
      },
    });
    if (completedNow) {
      await this.prisma.funnelEvent.create({
        data: {
          userId,
          type: FunnelEventType.CONTENT_COMPLETED,
          metadata: {
            entityType: 'content_item',
            entityId: item.id,
            itemId: item.id,
            seriesId: item.seriesId,
          },
          source: 'mobile',
        },
      });
    }
    return {
      itemId,
      percent: progress.percent,
      completedAt: progress.completedAt ? progress.completedAt.toISOString() : null,
      lastPositionSeconds: progress.lastPositionSeconds,
    };
  }

  async clickClientCta(userId: string, itemId: string, ctaId: string) {
    const item = await this.assertClientCanAccessItem(userId, itemId);
    const cta = await this.prisma.contentCta.findFirst({
      where: { id: ctaId, itemId, isActive: true },
    });
    if (!cta) throw new NotFoundException('CTA не найден');
    await this.prisma.funnelEvent.create({
      data: {
        userId,
        type: FunnelEventType.CTA_CLICKED,
        metadata: {
          entityType: 'content_cta',
          entityId: cta.id,
          itemId: item.id,
          seriesId: item.seriesId,
          ctaId: cta.id,
          target: cta.target,
        },
        source: 'mobile',
      },
    });
    return { ok: true as const, ctaId: cta.id, target: cta.target };
  }

  private async assertClientCanAccessItem(userId: string, itemId: string) {
    const item = await this.prisma.contentItem.findUnique({
      where: { id: itemId },
      include: { series: true },
    });
    if (!item || !item.isPublished || !item.series.isPublished) {
      throw new NotFoundException('Материал не найден');
    }
    if (item.audience !== ContentAudience.CLIENT && item.audience !== ContentAudience.EVERYONE) {
      throw new ForbiddenException('Материал не предназначен для клиента');
    }
    if (item.series.priceMinor > 0 && !item.isFreePreview) {
      const paidSeriesIds = await this.getPaidSeriesIds(userId);
      if (!paidSeriesIds.has(item.seriesId)) {
        throw new ForbiddenException('Материал доступен после оплаты');
      }
    }
    return item;
  }

  private async getPaidSeriesIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.orderItem.findMany({
      where: {
        contentSeriesId: { not: null },
        order: {
          userId,
          status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
        },
      },
      select: { contentSeriesId: true },
    });
    return new Set(rows.map((x) => x.contentSeriesId).filter((x): x is string => Boolean(x)));
  }

  private validateCtaTarget(dto: CreateContentCtaDto | UpdateContentCtaDto): void {
    const targetFields = [
      dto.targetProgramId,
      dto.targetSeriesId,
      dto.targetServiceId,
      dto.targetPhysicalGoodId,
      dto.targetQuizId,
      dto.targetExternalUrl,
    ].filter((x) => x !== undefined && x !== null);
    if (dto.target !== undefined) {
      const expected = this.expectedTargetField(dto.target);
      const actualNames = {
        targetProgramId: dto.targetProgramId,
        targetSeriesId: dto.targetSeriesId,
        targetServiceId: dto.targetServiceId,
        targetPhysicalGoodId: dto.targetPhysicalGoodId,
        targetQuizId: dto.targetQuizId,
        targetExternalUrl: dto.targetExternalUrl,
      };
      const wrong = Object.entries(actualNames)
        .filter(([k, v]) => k !== expected && v !== undefined && v !== null)
        .map(([k]) => k);
      if (wrong.length > 0) {
        throw new ConflictException(`Поля ${wrong.join(', ')} не соответствуют target=${dto.target}`);
      }
      if ((actualNames as Record<string, unknown>)[expected] == null) {
        throw new ConflictException(`Для target=${dto.target} обязательно поле ${expected}`);
      }
      return;
    }
    if (targetFields.length > 1) {
      throw new ConflictException('Разрешена только одна target-ссылка у CTA');
    }
  }

  private expectedTargetField(target: ContentCtaTarget): string {
    switch (target) {
      case ContentCtaTarget.PROGRAM:
      case 'PROGRAM':
      case 'PROGRAM_INQUIRY':
        return 'targetProgramId';
      case ContentCtaTarget.CONTENT_SERIES:
      case 'CONTENT_SERIES':
        return 'targetSeriesId';
      case ContentCtaTarget.SERVICE:
      case 'SERVICE':
        return 'targetServiceId';
      case ContentCtaTarget.PHYSICAL_GOOD:
      case 'PHYSICAL_GOOD':
        return 'targetPhysicalGoodId';
      case ContentCtaTarget.QUIZ:
      case 'QUIZ':
        return 'targetQuizId';
      case ContentCtaTarget.EXTERNAL_URL:
      case 'EXTERNAL_URL':
      default:
        return 'targetExternalUrl';
    }
  }

  private async createNewContentPushNotifications(
    networkId: string,
    itemId: string,
    audience: ContentAudience,
  ): Promise<number> {
    const roles =
      audience === ContentAudience.SPECIALIST
        ? [UserRole.Specialist]
        : audience === ContentAudience.EVERYONE
          ? [UserRole.Client, UserRole.Specialist]
          : [UserRole.Client];
    const devices = await this.prisma.pushDevice.findMany({
      where: {
        isActive: true,
        user: {
          role: { in: roles },
          studio: { networkId },
          OR: [
            { notificationPreference: null },
            {
              notificationPreference: {
                newContentPushEnabled: true,
                marketingPushEnabled: true,
              },
            },
          ],
        },
      },
      select: {
        token: true,
        provider: true,
        userId: true,
      },
    });
    if (devices.length === 0) return 0;

    const title = 'Новый контент';
    const body = 'Доступен новый материал в приложении Solodova Recovery System.';
    const payload: Prisma.InputJsonValue = {
      type: 'new_content',
      contentItemId: itemId,
    };

    if (!this.pushDelivery.usesRealExpoPush()) {
      await this.prisma.notification.createMany({
        data: devices.map((d) => ({
          userId: d.userId,
          type: NotificationType.NEW_CONTENT,
          channel: NotificationChannel.PUSH,
          status: NotificationStatus.SENT,
          title,
          body,
          recipient: d.token,
          pushProvider: d.provider as PushProvider,
          entityType: 'content_item',
          entityId: itemId,
          payload,
          sentAt: new Date(),
        })),
      });
      return devices.length;
    }

    const expoDevices = devices.filter((d) => d.provider === PushProvider.EXPO);
    const legacyDevices = devices.filter((d) => d.provider !== PushProvider.EXPO);

    const messages = expoDevices.map((d) => ({
      to: d.token,
      title,
      body,
      data: { type: 'new_content', contentItemId: itemId },
    }));

    let tickets: Awaited<ReturnType<PushDeliveryService['sendExpoTickets']>> = [];
    if (messages.length > 0) {
      try {
        tickets = await this.pushDelivery.sendExpoTickets(messages);
      } catch {
        for (const d of expoDevices) {
          await this.prisma.notification.create({
            data: {
              userId: d.userId,
              type: NotificationType.NEW_CONTENT,
              channel: NotificationChannel.PUSH,
              status: NotificationStatus.FAILED,
              title,
              body,
              recipient: d.token,
              pushProvider: d.provider as PushProvider,
              entityType: 'content_item',
              entityId: itemId,
              payload,
              failedAt: new Date(),
              failureReason: 'Expo Push API недоступен или вернул ошибку',
            },
          });
        }
        for (const d of legacyDevices) {
          await this.prisma.notification.create({
            data: {
              userId: d.userId,
              type: NotificationType.NEW_CONTENT,
              channel: NotificationChannel.PUSH,
              status: NotificationStatus.FAILED,
              title,
              body,
              recipient: d.token,
              pushProvider: d.provider as PushProvider,
              entityType: 'content_item',
              entityId: itemId,
              payload,
              failedAt: new Date(),
              failureReason:
                'Провайдер устройства не EXPO; на сервере включён только шлюз Expo Push.',
            },
          });
        }
        return devices.length;
      }
    }

    for (let i = 0; i < expoDevices.length; i++) {
      const d = expoDevices[i];
      const ticket = tickets[i];
      const ok = Boolean(ticket && ticket.status === 'ok');
      await this.prisma.notification.create({
        data: {
          userId: d.userId,
          type: NotificationType.NEW_CONTENT,
          channel: NotificationChannel.PUSH,
          status: ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
          title,
          body,
          recipient: d.token,
          pushProvider: d.provider as PushProvider,
          entityType: 'content_item',
          entityId: itemId,
          payload,
          providerMessageId: ok && ticket.status === 'ok' ? ticket.id : undefined,
          providerPayload: ticket ? (ticket as unknown as Prisma.InputJsonValue) : undefined,
          failureReason:
            ok || !ticket
              ? undefined
              : ticket.status === 'error'
                ? ticket.message
                : 'Неизвестный ответ Expo',
          sentAt: ok ? new Date() : undefined,
          failedAt: ok ? undefined : new Date(),
        },
      });
    }

    for (const d of legacyDevices) {
      await this.prisma.notification.create({
        data: {
          userId: d.userId,
          type: NotificationType.NEW_CONTENT,
          channel: NotificationChannel.PUSH,
          status: NotificationStatus.FAILED,
          title,
          body,
          recipient: d.token,
          pushProvider: d.provider as PushProvider,
          entityType: 'content_item',
          entityId: itemId,
          payload,
          failedAt: new Date(),
          failureReason:
            'Провайдер устройства не EXPO; на сервере включён только шлюз Expo Push.',
        },
      });
    }

    return devices.length;
  }

  private async resolveScopedNetworkId(
    user: JwtAccessPayload,
    requested?: string,
  ): Promise<string | undefined> {
    if (user.role !== UserRole.StudioAdmin) {
      return requested;
    }
    const row = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { studio: { select: { networkId: true } } },
    });
    const networkId = row?.studio?.networkId;
    if (!networkId) {
      throw new ForbiddenException('Администратору студии не назначена сеть');
    }
    return networkId;
  }

  private async assertAdminNetworkAccess(user: JwtAccessPayload, networkId: string): Promise<void> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
      select: { id: true },
    });
    if (!network) {
      throw new NotFoundException(`Сеть ${networkId} не найдена`);
    }
    if (
      user.role === UserRole.SuperAdmin ||
      user.role === UserRole.NetworkOwner ||
      user.role === UserRole.ContentAuthor
    ) {
      return;
    }
    if (user.role === UserRole.StudioAdmin) {
      const scoped = await this.resolveScopedNetworkId(user);
      if (scoped === networkId) return;
    }
    throw new ForbiddenException('Недостаточно прав для этой сети');
  }
}

