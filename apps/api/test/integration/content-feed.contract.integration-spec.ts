import { Test } from '@nestjs/testing';
import {
  ContentAudience,
  ContentCtaTarget,
  ContentFormat,
  OrderStatus,
  ProductType,
} from '@prisma/client';
import { UserRole } from '@srs/shared-types';


import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { ContentService } from '../../src/modules/content/application/content.service';
import { PushDeliveryService } from '../../src/modules/notifications/infrastructure/push/push-delivery.service';

import type { ClientContentFeedResponse } from '@srs/shared-types';

function assertClientFeedContract(body: ClientContentFeedResponse): void {
  expect(Array.isArray(body.items)).toBe(true);
  for (const item of body.items) {
    expect(item).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      seriesId: expect.any(String),
      audience: expect.any(String),
      format: expect.any(String),
      paywall: {
        mode: expect.stringMatching(/^(FREE|PAID|PLAN)$/),
        isLocked: expect.any(Boolean),
        priceMinor: expect.any(Number),
        currency: expect.any(String),
      },
      progress: {
        percent: expect.any(Number),
      },
    });
    expect(item.publishedAt === null || typeof item.publishedAt === 'string').toBe(true);
    expect(item.progress.completedAt === null || typeof item.progress.completedAt === 'string').toBe(true);
    expect(Array.isArray(item.ctas)).toBe(true);
    for (const cta of item.ctas) {
      expect(cta).toMatchObject({
        id: expect.any(String),
        target: expect.any(String),
        label: expect.any(String),
        sortOrder: expect.any(Number),
      });
      for (const key of [
        'subtitle',
        'targetProgramId',
        'targetSeriesId',
        'targetServiceId',
        'targetPhysicalGoodId',
        'targetQuizId',
        'targetExternalUrl',
      ] as const) {
        const v = cta[key];
        expect(v === null || typeof v === 'string').toBe(true);
      }
    }
  }
}

describe('Content feed API contract (integration)', () => {
  let prisma: PrismaService;
  let content: ContentService;

  beforeAll(async () => {
    const push = {
      usesRealExpoPush: (): boolean => false,
      sendExpoTickets: async (): Promise<Array<{ status: 'ok'; id: string }>> => [],
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        ContentService,
        { provide: PushDeliveryService, useValue: push },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    content = moduleRef.get(ContentService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await prisma.truncateAll();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns published CLIENT item with normalized CTA target ids (nulls)', async () => {
    const network = await prisma.network.create({ data: { name: 'Net', slug: 'net-cfc' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio',
        address: 'A',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const author = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.ContentAuthor,
        phone: '+79991110001',
        firstName: 'A',
        lastName: 'B',
      },
    });
    const series = await prisma.contentSeries.create({
      data: {
        networkId: network.id,
        authorUserId: author.id,
        slug: 'series-cfc',
        title: 'Series',
        audience: ContentAudience.CLIENT,
        isPublished: true,
        publishedAt: new Date(),
        priceMinor: 0,
      },
    });
    const item = await prisma.contentItem.create({
      data: {
        networkId: network.id,
        seriesId: series.id,
        authorUserId: author.id,
        slug: 'item-cfc',
        title: 'Item',
        format: ContentFormat.ARTICLE,
        audience: ContentAudience.CLIENT,
        body: { markdown: 'x' },
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    await prisma.contentCta.create({
      data: {
        itemId: item.id,
        target: ContentCtaTarget.EXTERNAL_URL,
        label: 'Go',
        targetExternalUrl: 'https://example.com/x',
        sortOrder: 0,
      },
    });

    const feed = await content.getClientFeed();
    assertClientFeedContract(feed);
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].ctas[0]).toMatchObject({
      target: 'EXTERNAL_URL',
      label: 'Go',
      targetExternalUrl: 'https://example.com/x',
      targetProgramId: null,
      targetServiceId: null,
    });
  });

  it('excludes SPECIALIST-only and unpublished items from client feed', async () => {
    const network = await prisma.network.create({ data: { name: 'Net2', slug: 'net-cfc2' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio',
        address: 'A',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const author = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.ContentAuthor,
        phone: '+79991110002',
        firstName: 'A',
        lastName: 'B',
      },
    });
    const pubSeries = await prisma.contentSeries.create({
      data: {
        networkId: network.id,
        authorUserId: author.id,
        slug: 'pub-ser',
        title: 'Pub',
        audience: ContentAudience.CLIENT,
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    await prisma.contentItem.create({
      data: {
        networkId: network.id,
        seriesId: pubSeries.id,
        authorUserId: author.id,
        slug: 'spec-item',
        title: 'Staff only',
        format: ContentFormat.ARTICLE,
        audience: ContentAudience.SPECIALIST,
        body: {},
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    const draftSeries = await prisma.contentSeries.create({
      data: {
        networkId: network.id,
        authorUserId: author.id,
        slug: 'draft-ser',
        title: 'Draft ser',
        audience: ContentAudience.CLIENT,
        isPublished: false,
      },
    });
    await prisma.contentItem.create({
      data: {
        networkId: network.id,
        seriesId: draftSeries.id,
        authorUserId: author.id,
        slug: 'draft-item',
        title: 'Draft item',
        format: ContentFormat.ARTICLE,
        audience: ContentAudience.CLIENT,
        body: {},
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    const feed = await content.getClientFeed();
    expect(feed.items).toHaveLength(0);
  });

  it('paywall: PAID series is locked until a PAID order exists for that series', async () => {
    const network = await prisma.network.create({ data: { name: 'Net3', slug: 'net-cfc3' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio',
        address: 'A',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const author = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.ContentAuthor,
        phone: '+79991110003',
        firstName: 'A',
        lastName: 'B',
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79991110004',
        firstName: 'C',
        lastName: 'D',
      },
    });
    const paidSeries = await prisma.contentSeries.create({
      data: {
        networkId: network.id,
        authorUserId: author.id,
        slug: 'paid-ser',
        title: 'Paid',
        audience: ContentAudience.CLIENT,
        isPublished: true,
        publishedAt: new Date(),
        priceMinor: 9_900,
        currency: 'RUB',
      },
    });
    await prisma.contentItem.create({
      data: {
        networkId: network.id,
        seriesId: paidSeries.id,
        authorUserId: author.id,
        slug: 'paid-item',
        title: 'Paid item',
        format: ContentFormat.VIDEO,
        audience: ContentAudience.CLIENT,
        body: { videoUrl: 'https://example.com/v.mp4' },
        isPublished: true,
        publishedAt: new Date(),
        isFreePreview: false,
      },
    });

    const lockedFeed = await content.getClientFeed(client.id);
    expect(lockedFeed.items).toHaveLength(1);
    expect(lockedFeed.items[0].paywall).toMatchObject({
      mode: 'PAID',
      isLocked: true,
      priceMinor: 9_900,
    });

    await prisma.order.create({
      data: {
        userId: client.id,
        orderNumber: 'ORD-CFC-1',
        status: OrderStatus.PAID,
        currency: 'RUB',
        subtotalMinor: 9_900,
        totalMinor: 9_900,
        items: {
          create: {
            productType: ProductType.DIGITAL_CONTENT,
            contentSeriesId: paidSeries.id,
            nameSnapshot: 'Paid',
            unitPriceMinor: 9_900,
            totalMinor: 9_900,
          },
        },
      },
    });

    const unlockedFeed = await content.getClientFeed(client.id);
    expect(unlockedFeed.items[0].paywall).toMatchObject({
      mode: 'PAID',
      isLocked: false,
    });
  });
});
