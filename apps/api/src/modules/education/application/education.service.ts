/* eslint-disable import/order */
import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { ConfigService } from '@nestjs/config';
import { ContentFormat, OrderStatus } from '@prisma/client';

import {
  getStaticEducationCatalog,
  prismaAudience,
} from '../domain/education-static-catalog';

import type { EducationConfig } from '../../../config/education.config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type {
  EducationAudienceParam,
  EducationScreenPayload} from '../domain/education-static-catalog';
import type { ContentAudience, Prisma } from '@prisma/client';

@Injectable()
export class EducationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getScreen(userId: string, audience: EducationAudienceParam): Promise<EducationScreenPayload> {
    const aud = prismaAudience(audience);

    const [myCourses, freeMaterials, featured] = await Promise.all([
      this.loadMyCourses(userId, aud),
      this.loadFreeMaterials(aud),
      this.loadFeatured(aud),
    ]);

    const empty = myCourses.length === 0 && freeMaterials.length === 0 && featured.length === 0;
    const staticFallback = this.config.get<EducationConfig['staticFallback']>('education.staticFallback', true);
    if (empty && staticFallback) {
      return getStaticEducationCatalog(audience);
    }

    return {
      myCourses,
      freeMaterials,
      featured,
    };
  }

  private async loadMyCourses(userId: string, audience: ContentAudience): Promise<EducationScreenPayload['myCourses']> {
    const [progressSeriesIds, paidSeries] = await Promise.all([
      this.prisma.contentItemProgress.findMany({
        where: { userId },
        select: { item: { select: { seriesId: true } } },
      }),
      this.prisma.orderItem.findMany({
        where: {
          contentSeriesId: { not: null },
          order: {
            userId,
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
          },
        },
        select: { contentSeriesId: true },
      }),
    ]);

    const idSet = new Set<string>();
    for (const r of progressSeriesIds) idSet.add(r.item.seriesId);
    for (const p of paidSeries) {
      if (p.contentSeriesId) idSet.add(p.contentSeriesId);
    }
    const allIds = [...idSet];
    if (allIds.length === 0) return [];

    const seriesList = await this.prisma.contentSeries.findMany({
      where: { id: { in: allIds }, isPublished: true, audience },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            progress: {
              where: { userId },
              select: { percent: true, completedAt: true },
            },
          },
        },
      },
    });

    const result: EducationScreenPayload['myCourses'] = [];
    for (const s of seriesList) {
      const totalLessons = s.items.length;
      if (totalLessons === 0) continue;
      let completedLessons = 0;
      let sumPercent = 0;
      for (const it of s.items) {
        const pr = it.progress[0];
        const done = Boolean(pr?.completedAt) || (pr?.percent ?? 0) >= 100;
        if (done) completedLessons += 1;
        sumPercent += Math.min(100, pr?.percent ?? 0);
      }
      const progressPercent = Math.round(sumPercent / totalLessons);
      result.push({
        id: s.id,
        title: s.title,
        coverUrl: s.coverImageUrl,
        progressPercent,
        completedLessons,
        totalLessons,
      });
    }

    result.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    return result;
  }

  private async loadFreeMaterials(audience: ContentAudience): Promise<EducationScreenPayload['freeMaterials']> {
    const items = await this.prisma.contentItem.findMany({
      where: {
        isPublished: true,
        audience,
        format: { in: [ContentFormat.VIDEO, ContentFormat.ARTICLE] },
        OR: [{ isFreePreview: true }, { series: { priceMinor: 0, isPublished: true } }],
      },
      take: 24,
      orderBy: [{ series: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: {
        id: true,
        title: true,
        coverImageUrl: true,
        format: true,
        durationSeconds: true,
        description: true,
      },
    });

    return items.map((it) => {
      const kind = it.format === ContentFormat.VIDEO ? 'video' : 'article';
      let metaLabel = '';
      if (it.format === ContentFormat.VIDEO && it.durationSeconds != null) {
        const m = Math.max(1, Math.round(it.durationSeconds / 60));
        metaLabel = `${m} мин`;
      } else {
        metaLabel = 'Статья';
      }
      return {
        id: it.id,
        title: it.title,
        coverUrl: it.coverImageUrl,
        kind: kind as 'video' | 'article',
        metaLabel,
      };
    });
  }

  private async loadFeatured(audience: ContentAudience): Promise<EducationScreenPayload['featured']> {
    const webinars = await this.prisma.contentItem.findMany({
      where: {
        isPublished: true,
        audience,
        format: ContentFormat.WEBINAR,
      },
      take: 12,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        coverImageUrl: true,
        body: true,
        series: { select: { priceMinor: true } },
      },
    });

    const programs = await this.prisma.program.findMany({
      where: { isPublished: true },
      take: 12,
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        coverImageUrl: true,
        priceMinor: true,
        stages: true,
        durationDays: true,
      },
    });

    const featured: EducationScreenPayload['featured'] = [];

    for (const w of webinars) {
      const body = w.body as Prisma.JsonObject | null;
      const scheduledAt =
        typeof body?.scheduledAt === 'string'
          ? new Date(body.scheduledAt as string)
          : typeof body?.startsAt === 'string'
            ? new Date(body.startsAt as string)
            : null;
      const priceRub = Math.round((w.series?.priceMinor ?? 0) / 100);
      let metaLeft = 'Скоро';
      let metaRight = '';
      if (scheduledAt && !Number.isNaN(scheduledAt.getTime())) {
        metaLeft = scheduledAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        metaRight = scheduledAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      }
      featured.push({
        id: w.id,
        format: 'webinar',
        title: w.title,
        description: (w.description ?? '').slice(0, 280),
        coverUrl: w.coverImageUrl,
        priceRub,
        metaLeft,
        metaRight,
        cta: 'register',
      });
    }

    for (const p of programs) {
      const stagesLen = Array.isArray(p.stages) ? (p.stages as unknown[]).length : 0;
      const modulesLabel = stagesLen > 0 ? `${stagesLen} модулей` : `${Math.max(1, Math.ceil(p.durationDays / 30))} мес`;
      featured.push({
        id: p.id,
        format: 'intensive',
        title: p.title,
        description: p.description.slice(0, 280),
        coverUrl: p.coverImageUrl,
        priceRub: Math.round(p.priceMinor / 100),
        metaLeft: modulesLabel,
        metaRight: 'Доступ по программе',
        cta: 'details',
      });
    }

    return featured;
  }
}
