import { ContentAudience, ContentFormat, FaqCategory, UserRole } from '@srs/shared-types';
import { addMinutes } from 'date-fns';
import request from 'supertest';

import { buildTestApp } from '../helpers/build-test-app';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import type { INestApplication } from '@nestjs/common';

async function loginClient(app: INestApplication, phone?: string) {
  const actualPhone = phone ?? `+7999${Math.floor(1000000 + Math.random() * 8999999)}`;
  const requestOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({
    phone: actualPhone,
  });
  expect(requestOtp.status).toBe(201);
  expect(typeof requestOtp.body.debugCode).toBe('string');

  const verifyOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({
    phone: actualPhone,
    code: requestOtp.body.debugCode,
    deviceType: 'mobile_android',
  });
  expect(verifyOtp.status).toBe(201);
  expect(verifyOtp.body.user.role).toBe(UserRole.Client);

  return {
    accessToken: verifyOtp.body.tokens.accessToken as string,
    refreshToken: verifyOtp.body.tokens.refreshToken as string,
    userId: verifyOtp.body.user.id as string,
    phone: actualPhone,
  };
}

describe('Client home prerequisites (e2e)', () => {
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

  it('GET/PATCH /me (authorized) and 401 (unauthorized)', async () => {
    const unauthorized = await request(app.getHttpServer()).get('/api/v1/me');
    expect(unauthorized.status).toBe(401);

    const { accessToken, phone } = await loginClient(app);

    const me1 = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me1.status).toBe(200);
    expect(me1.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        role: UserRole.Client,
        phone,
        firstName: expect.any(String),
        lastName: expect.any(String),
        email: null,
        birthDate: null,
      }),
    );

    const patch = await request(app.getHttpServer())
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Мария', lastName: 'Иванова' });
    expect(patch.status).toBe(200);
    expect(patch.body.firstName).toBe('Мария');
    expect(patch.body.lastName).toBe('Иванова');

    const me2 = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me2.status).toBe(200);
    expect(me2.body.firstName).toBe('Мария');
    expect(me2.body.lastName).toBe('Иванова');

    const forbiddenPatch = await request(app.getHttpServer())
      .patch('/api/v1/me/medical-card')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        chronicDiseases: ['test'],
      });
    expect(forbiddenPatch.status).toBe(403);
  });

  it('enforces auth on client protected endpoints', async () => {
    const protectedEndpoints = [
      '/api/v1/studios',
      '/api/v1/studios/studio-directions',
      '/api/v1/content/feed',
      '/api/v1/client/content/feed',
      '/api/v1/faq',
      '/api/v1/appointments/next',
      '/api/v1/education/screen',
      '/api/v1/me/medical-card',
      '/api/v1/me/consents',
    ];

    for (const endpoint of protectedEndpoints) {
      const res = await request(app.getHttpServer()).get(endpoint);
      expect(res.status).toBe(401);
    }
  });

  it('GET /education/screen accepts OkHttp-style cache buster ?_= on query', async () => {
    const { accessToken } = await loginClient(app);
    const res = await request(app.getHttpServer())
      .get('/api/v1/education/screen')
      .query({ audience: 'client', _: String(Date.now()) })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        myCourses: expect.any(Array),
        freeMaterials: expect.any(Array),
        featured: expect.any(Array),
      }),
    );
  });

  it('GET /studios returns active studios', async () => {
    const { accessToken } = await loginClient(app);

    const network = await prisma.network.create({
      data: { name: 'Net', slug: 'net' },
    });
    const active = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio A',
        address: 'ул. Ленина, 45',
        city: 'Москва',
        timezone: 'Europe/Moscow',
        phone: '+79990000000',
        openingHours: {},
        isActive: true,
      },
    });
    await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio Hidden',
        address: 'ул. Скрытая, 1',
        city: 'Москва',
        timezone: 'Europe/Moscow',
        phone: '+79990000001',
        openingHours: {},
        isActive: false,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/studios')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        id: active.id,
        name: 'Studio A',
        address: 'ул. Ленина, 45',
        phone: '+79990000000',
      }),
    );
  });

  it('GET /content/feed returns published items newest-first', async () => {
    const { accessToken, userId } = await loginClient(app);

    const network = await prisma.network.create({
      data: { name: 'Net C', slug: 'net-c' },
    });

    // For MVP we don't enforce author role here; just satisfy relations.
    const author = await prisma.user.create({
      data: {
        role: UserRole.ContentAuthor,
        phone: '+79990001111',
        firstName: 'Автор',
        lastName: 'Контента',
        locale: 'ru',
      },
    });

    const series = await prisma.contentSeries.create({
      data: {
        networkId: network.id,
        authorUserId: author.id,
        slug: 's1',
        title: 'Серия 1',
        audience: ContentAudience.Client as any,
        tags: [],
        priceMinor: 0,
        currency: 'RUB',
        sortOrder: 0,
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    const older = await prisma.contentItem.create({
      data: {
        networkId: network.id,
        seriesId: series.id,
        authorUserId: author.id,
        slug: 'older',
        title: 'Старое',
        format: ContentFormat.Article as any,
        audience: ContentAudience.Client as any,
        body: { markdown: 'old' },
        isPublished: true,
        publishedAt: addMinutes(new Date(), -20),
        tags: [],
      },
    });
    const newer = await prisma.contentItem.create({
      data: {
        networkId: network.id,
        seriesId: series.id,
        authorUserId: author.id,
        slug: 'newer',
        title: 'Новое',
        format: ContentFormat.Video as any,
        audience: ContentAudience.Client as any,
        body: { videoUrl: 'https://example.com/v.mp4' },
        isPublished: true,
        publishedAt: addMinutes(new Date(), -5),
        tags: [],
      },
    });
    await prisma.contentItem.create({
      data: {
        networkId: network.id,
        seriesId: series.id,
        authorUserId: author.id,
        slug: 'draft',
        title: 'Черновик',
        format: ContentFormat.Article as any,
        audience: ContentAudience.Client as any,
        body: { markdown: 'draft' },
        isPublished: false,
        tags: [],
      },
    });

    // Ensure client exists too (not strictly needed for content feed).
    expect(userId).toBeTruthy();

    const res = await request(app.getHttpServer())
      .get('/api/v1/content/feed')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.items.map((i: any) => i.id)).toEqual([newer.id, older.id]);
    expect(res.body.items[0]).toEqual(
      expect.objectContaining({
        id: newer.id,
        title: 'Новое',
        coverImageUrl: null,
        publishedAt: expect.any(String),
      }),
    );
  });

  it('GET /faq returns active items ordered by sortOrder', async () => {
    const { accessToken } = await loginClient(app);

    await prisma.faqItem.create({
      data: {
        category: FaqCategory.Account as any,
        question: 'Q2',
        answer: 'A2',
        sortOrder: 2,
        isActive: true,
      },
    });
    await prisma.faqItem.create({
      data: {
        category: FaqCategory.Account as any,
        question: 'Q1',
        answer: 'A1',
        sortOrder: 1,
        isActive: true,
      },
    });
    await prisma.faqItem.create({
      data: {
        category: FaqCategory.Account as any,
        question: 'Hidden',
        answer: 'Hidden',
        sortOrder: 0,
        isActive: false,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/faq')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((x: any) => x.question)).toEqual(['Q1', 'Q2']);

    await prisma.studioDirection.create({
      data: {
        slug: 'sd-second',
        title: 'Второе',
        description: 'Описание B',
        iconKey: 'leaf',
        sortOrder: 20,
        isActive: true,
      },
    });
    await prisma.studioDirection.create({
      data: {
        slug: 'sd-first',
        title: 'Первое',
        description: 'Описание A',
        iconKey: 'spa',
        sortOrder: 10,
        isActive: true,
      },
    });
    await prisma.studioDirection.create({
      data: {
        slug: 'sd-hidden',
        title: 'Скрыто',
        description: null,
        iconKey: 'star',
        sortOrder: 5,
        isActive: false,
      },
    });

    const sdRes = await request(app.getHttpServer())
      .get('/api/v1/studios/studio-directions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(sdRes.status).toBe(200);
    expect(sdRes.body).toHaveLength(2);
    expect(sdRes.body.map((x: { slug: string }) => x.slug)).toEqual(['sd-first', 'sd-second']);
    expect(sdRes.body[0]).toEqual(
      expect.objectContaining({
        slug: 'sd-first',
        title: 'Первое',
        description: 'Описание A',
        iconKey: 'spa',
      }),
    );
  });

  it('GET /appointments/next returns nearest upcoming appointment for current client', async () => {
    const { accessToken, userId } = await loginClient(app);

    const network = await prisma.network.create({
      data: { name: 'Net A', slug: 'net-a' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio',
        address: 'ул. Ленина, 45',
        city: 'Москва',
        openingHours: {},
        phone: '+79990000000',
      },
    });
    const specialistUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79990010001',
        firstName: 'Анна',
        lastName: 'Иванова',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: { userId: specialistUser.id, studioId: studio.id },
    });
    const service = await prisma.service.create({
      data: {
        studioId: studio.id,
        name: 'Медицинский педикюр',
        durationMinutes: 60,
        priceMinor: 180000,
      },
    });

    const later = addMinutes(new Date(), 240);
    const sooner = addMinutes(new Date(), 120);

    await prisma.appointment.create({
      data: {
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: userId,
        startsAt: later,
        endsAt: addMinutes(later, 60),
        status: 'CONFIRMED',
        source: 'MOBILE_APP',
        totalMinor: 180000,
      } as any,
    });
    await prisma.appointment.create({
      data: {
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: userId,
        startsAt: sooner,
        endsAt: addMinutes(sooner, 60),
        status: 'CONFIRMED',
        source: 'MOBILE_APP',
        totalMinor: 180000,
      } as any,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/appointments/next')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        startsAt: sooner.toISOString(),
        studio: expect.objectContaining({ id: studio.id, address: 'ул. Ленина, 45' }),
        specialist: expect.objectContaining({ firstName: 'Анна', lastName: 'Иванова' }),
        service: expect.objectContaining({ name: 'Медицинский педикюр' }),
      }),
    );
  });
});

