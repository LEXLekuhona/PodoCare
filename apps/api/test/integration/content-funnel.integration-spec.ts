import { Test } from '@nestjs/testing';
import { ContentAudience, ContentFormat, FunnelEventType } from '@prisma/client';
import { UserRole } from '@srs/shared-types';

import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

describe('Content funnel repositories (integration)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await prisma.truncateAll();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('upserts content progress by (userId, itemId)', async () => {
    const network = await prisma.network.create({ data: { name: 'Net Int', slug: 'net-int' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio Int',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const author = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.ContentAuthor,
        phone: '+79990001010',
        firstName: 'A',
        lastName: 'B',
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79990001011',
        firstName: 'C',
        lastName: 'D',
      },
    });
    const series = await prisma.contentSeries.create({
      data: {
        networkId: network.id,
        authorUserId: author.id,
        slug: 'series-int',
        title: 'Series',
        audience: ContentAudience.CLIENT,
      },
    });
    const item = await prisma.contentItem.create({
      data: {
        networkId: network.id,
        seriesId: series.id,
        authorUserId: author.id,
        slug: 'item-int',
        title: 'Item',
        format: ContentFormat.ARTICLE,
        audience: ContentAudience.CLIENT,
        body: { markdown: 'x' },
        isPublished: true,
      },
    });

    await prisma.contentItemProgress.upsert({
      where: { userId_itemId: { userId: client.id, itemId: item.id } },
      create: { userId: client.id, itemId: item.id, percent: 20 },
      update: { percent: 20 },
    });
    await prisma.contentItemProgress.upsert({
      where: { userId_itemId: { userId: client.id, itemId: item.id } },
      create: { userId: client.id, itemId: item.id, percent: 60 },
      update: { percent: 60, completedAt: new Date('2026-05-06T00:00:00.000Z') },
    });

    const progress = await prisma.contentItemProgress.findUnique({
      where: { userId_itemId: { userId: client.id, itemId: item.id } },
    });
    expect(progress?.percent).toBe(60);
    expect(progress?.completedAt?.toISOString()).toBe('2026-05-06T00:00:00.000Z');
  });

  it('stores funnel events append-only with metadata', async () => {
    const user = await prisma.user.create({
      data: {
        role: UserRole.Client,
        phone: '+79990001012',
        firstName: 'Event',
        lastName: 'User',
      },
    });

    await prisma.funnelEvent.create({
      data: {
        userId: user.id,
        type: FunnelEventType.CONTENT_VIEWED,
        metadata: { entityType: 'content_item', entityId: 'item-1', percent: 40 },
        source: 'mobile',
      },
    });
    await prisma.funnelEvent.create({
      data: {
        userId: user.id,
        type: FunnelEventType.CTA_CLICKED,
        metadata: { entityType: 'content_cta', entityId: 'cta-1' },
        source: 'mobile',
      },
    });

    const events = await prisma.funnelEvent.findMany({
      where: { userId: user.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('CONTENT_VIEWED');
    expect(events[1].type).toBe('CTA_CLICKED');
  });
});
