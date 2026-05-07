import { ContentAudience, ContentFormat, UserRole } from '@srs/shared-types';
import argon2 from 'argon2';
import request from 'supertest';

import { buildTestApp } from '../helpers/build-test-app';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import type { INestApplication } from '@nestjs/common';

async function loginStaff(app: INestApplication, email: string, password: string): Promise<string> {
  const login = await request(app.getHttpServer()).post('/api/v1/auth/staff/login').send({
    email,
    password,
    deviceType: 'admin_web',
  });
  expect(login.status).toBe(201);
  return login.body.tokens.accessToken as string;
}

async function loginClientByOtp(app: INestApplication, phone: string): Promise<{ token: string; userId: string }> {
  const requestOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone });
  expect(requestOtp.status).toBe(201);
  const verifyOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({
    phone,
    code: requestOtp.body.debugCode,
    deviceType: 'mobile_ios',
  });
  expect(verifyOtp.status).toBe(201);
  return {
    token: verifyOtp.body.tokens.accessToken as string,
    userId: verifyOtp.body.user.id as string,
  };
}

describe('Content Funnel (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });

  beforeEach(async () => {
    await prisma.truncateAll();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('author creates and publishes content, client sees feed and progress/cta are tracked', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net Content', slug: 'net-content' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio Content',
        address: 'ул. Тестовая, 1',
        city: 'Москва',
        openingHours: {},
        phone: '+79991112233',
      },
    });
    const authorPassword = 'StrongPass123!';
    const author = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.ContentAuthor,
        phone: '+79990000010',
        email: 'author@solodova-recovery.local',
        passwordHash: await argon2.hash(authorPassword),
        firstName: 'Автор',
        lastName: 'Контента',
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79990000011',
        firstName: 'Клиент',
        lastName: 'Обычный',
      },
    });
    const otherNetwork = await prisma.network.create({
      data: { name: 'Net Other', slug: 'net-other' },
    });
    const otherStudio = await prisma.studio.create({
      data: {
        networkId: otherNetwork.id,
        name: 'Studio Other',
        address: 'ул. Другая, 2',
        city: 'Москва',
        openingHours: {},
        phone: '+79994445566',
      },
    });
    const foreignClient = await prisma.user.create({
      data: {
        studioId: otherStudio.id,
        role: UserRole.Client,
        phone: '+79990000012',
        firstName: 'Чужой',
        lastName: 'Клиент',
      },
    });

    await prisma.notificationPreference.create({
      data: {
        userId: client.id,
        newContentPushEnabled: true,
        marketingPushEnabled: true,
      },
    });
    await prisma.notificationPreference.create({
      data: {
        userId: foreignClient.id,
        newContentPushEnabled: true,
        marketingPushEnabled: true,
      },
    });

    await prisma.pushDevice.create({
      data: {
        userId: client.id,
        provider: 'EXPO',
        token: 'ExpoPushToken[client-content]',
        deviceType: 'mobile_ios',
      },
    });
    await prisma.pushDevice.create({
      data: {
        userId: foreignClient.id,
        provider: 'EXPO',
        token: 'ExpoPushToken[foreign-content]',
        deviceType: 'mobile_ios',
      },
    });

    const authorToken = await loginStaff(app, author.email!, authorPassword);
    const { token: clientToken } = await loginClientByOtp(app, client.phone);

    const createSeries = await request(app.getHttpServer())
      .post('/api/v1/content/series')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        networkId: network.id,
        title: 'Серия по уходу',
        audience: ContentAudience.Client,
        priceMinor: 0,
        status: 'draft',
      });
    expect(createSeries.status).toBe(201);

    const createItem = await request(app.getHttpServer())
      .post('/api/v1/content/items')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        networkId: network.id,
        seriesId: createSeries.body.id,
        title: 'Видео: базовый уход',
        format: ContentFormat.Video,
        audience: ContentAudience.Client,
        body: { videoUrl: 'https://example.com/video.mp4' },
        status: 'draft',
      });
    expect(createItem.status).toBe(201);

    const createCta = await request(app.getHttpServer())
      .post(`/api/v1/content/items/${createItem.body.id}/cta`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        target: 'EXTERNAL_URL',
        label: 'Записаться на консультацию',
        targetExternalUrl: 'https://solodova-recovery.app/consultation',
      });
    expect(createCta.status).toBe(201);
    const ctaId = createCta.body.id as string;

    const publish = await request(app.getHttpServer())
      .post(`/api/v1/content/items/${createItem.body.id}/publish`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(publish.status).toBe(201);
    expect(publish.body.pushQueued).toBe(1);

    const feed = await request(app.getHttpServer())
      .get('/api/v1/client/content/feed')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(feed.status).toBe(200);
    const feedItem = feed.body.items.find((x: { id: string }) => x.id === createItem.body.id);
    expect(feedItem).toBeDefined();
    expect(feedItem).toEqual(
      expect.objectContaining({
        id: createItem.body.id,
        title: 'Видео: базовый уход',
        publishedAt: expect.any(String),
        seriesId: createSeries.body.id,
        audience: 'CLIENT',
        format: 'VIDEO',
        paywall: expect.objectContaining({ mode: 'FREE', isLocked: false, priceMinor: 0, currency: 'RUB' }),
        progress: expect.objectContaining({ percent: 0, completedAt: null }),
        ctas: [
          expect.objectContaining({
            id: ctaId,
            target: 'EXTERNAL_URL',
            label: 'Записаться на консультацию',
            subtitle: null,
            sortOrder: 0,
            targetExternalUrl: 'https://solodova-recovery.app/consultation',
            targetProgramId: null,
            targetSeriesId: null,
            targetServiceId: null,
            targetPhysicalGoodId: null,
            targetQuizId: null,
          }),
        ],
      }),
    );

    const saveProgress = await request(app.getHttpServer())
      .post(`/api/v1/client/content/items/${createItem.body.id}/progress`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ percent: 100, lastPositionSeconds: 600 });
    expect(saveProgress.status).toBe(201);
    expect(saveProgress.body.percent).toBe(100);
    expect(saveProgress.body.completedAt).toEqual(expect.any(String));

    const clickCta = await request(app.getHttpServer())
      .post(`/api/v1/client/content/items/${createItem.body.id}/cta/${ctaId}/click`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});
    expect(clickCta.status).toBe(201);
    expect(clickCta.body).toMatchObject({
      ok: true,
      ctaId,
      target: 'EXTERNAL_URL',
      targetExternalUrl: 'https://solodova-recovery.app/consultation',
      targetProgramId: null,
      targetSeriesId: null,
      targetServiceId: null,
      targetPhysicalGoodId: null,
      targetQuizId: null,
    });

    const progress = await prisma.contentItemProgress.findUnique({
      where: { userId_itemId: { userId: client.id, itemId: createItem.body.id } },
    });
    expect(progress?.percent).toBe(100);
    expect(progress?.completedAt).toBeTruthy();

    const events = await prisma.funnelEvent.findMany({
      where: { userId: client.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((x) => x.type)).toEqual(
      expect.arrayContaining(['CONTENT_VIEWED', 'CONTENT_COMPLETED', 'CTA_CLICKED']),
    );

    const pushForClient = await prisma.notification.count({
      where: {
        userId: client.id,
        type: 'NEW_CONTENT',
        channel: 'PUSH',
        entityType: 'content_item',
        entityId: createItem.body.id,
      },
    });
    const pushForForeignClient = await prisma.notification.count({
      where: {
        userId: foreignClient.id,
        type: 'NEW_CONTENT',
        channel: 'PUSH',
        entityType: 'content_item',
        entityId: createItem.body.id,
      },
    });
    expect(pushForClient).toBe(1);
    expect(pushForForeignClient).toBe(0);
  });

  it('protects admin and client content endpoints with 401/403', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net Protect', slug: 'net-protect' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio Protect',
        address: 'ул. Защиты, 3',
        city: 'Москва',
        openingHours: {},
        phone: '+79990000013',
      },
    });
    const authorPassword = 'StrongPass123!';
    const author = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.ContentAuthor,
        phone: '+79990000014',
        email: 'author2@solodova-recovery.local',
        passwordHash: await argon2.hash(authorPassword),
        firstName: 'Автор',
        lastName: 'Два',
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79990000015',
        firstName: 'Клиент',
        lastName: 'Два',
      },
    });

    const unauthorized = await request(app.getHttpServer()).get('/api/v1/client/content/feed');
    expect(unauthorized.status).toBe(401);

    const authorToken = await loginStaff(app, author.email!, authorPassword);
    const { token: clientToken } = await loginClientByOtp(app, client.phone);

    const clientToAdmin = await request(app.getHttpServer())
      .post('/api/v1/content/series')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        networkId: network.id,
        title: 'Forbidden',
        audience: ContentAudience.Client,
      });
    expect(clientToAdmin.status).toBe(403);

    const authorToClient = await request(app.getHttpServer())
      .get('/api/v1/client/content/feed')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(authorToClient.status).toBe(403);
  });
});
