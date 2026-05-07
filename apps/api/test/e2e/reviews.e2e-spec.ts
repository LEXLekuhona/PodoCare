import { UserRole } from '@srs/shared-types';
import argon2 from 'argon2';
import request from 'supertest';

import { buildTestApp } from '../helpers/build-test-app';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import type { INestApplication } from '@nestjs/common';

async function loginClient(app: INestApplication, phone?: string) {
  const actualPhone = phone ?? `+7999${Math.floor(1000000 + Math.random() * 8999999)}`;
  const requestOtp = await request(app.getHttpServer())
    .post('/api/v1/auth/otp/request')
    .send({ phone: actualPhone });
  expect(requestOtp.status).toBe(201);

  const verifyOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({
    phone: actualPhone,
    code: requestOtp.body.debugCode,
    deviceType: 'mobile_ios',
  });
  expect(verifyOtp.status).toBe(201);
  return {
    accessToken: verifyOtp.body.tokens.accessToken as string,
    userId: verifyOtp.body.user.id as string,
    phone: actualPhone,
  };
}

async function loginStaff(app: INestApplication, email: string, password: string): Promise<string> {
  const login = await request(app.getHttpServer()).post('/api/v1/auth/staff/login').send({
    email,
    password,
    deviceType: 'admin_web',
  });
  expect(login.status).toBe(201);
  return login.body.tokens.accessToken as string;
}

async function seedStudio(prisma: PrismaService, label = 'A') {
  const network = await prisma.network.create({
    data: { name: `Net ${label}`, slug: `net-${label.toLowerCase()}` },
  });
  const studio = await prisma.studio.create({
    data: {
      networkId: network.id,
      name: `Studio ${label}`,
      address: 'ул. Ленина, 45',
      city: 'Москва',
      timezone: 'Europe/Moscow',
      openingHours: {},
      isActive: true,
    },
  });
  return { network, studio };
}

describe('Reviews (e2e)', () => {
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

  it('rejects unauthenticated POST /reviews with 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .send({ comment: 'Очень понравился визит!' });
    expect(res.status).toBe(401);
  });

  it('rejects too short comments with 400', async () => {
    const { studio } = await seedStudio(prisma, 'Short');
    const { accessToken, userId } = await loginClient(app);
    await prisma.user.update({ where: { id: userId }, data: { studioId: studio.id } });

    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ comment: 'короткий' });
    expect(res.status).toBe(400);
  });

  it('rejects empty payload (no comment, no ratings) with 400', async () => {
    const { studio } = await seedStudio(prisma, 'Empty');
    const { accessToken, userId } = await loginClient(app);
    await prisma.user.update({ where: { id: userId }, data: { studioId: studio.id } });

    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('forbids staff (non-client) from creating reviews', async () => {
    const { studio } = await seedStudio(prisma, 'Staff');
    const adminPassword = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.StudioAdmin,
        phone: '+79990001100',
        email: 'reviews-admin@solodova-recovery.local',
        passwordHash: await argon2.hash(adminPassword),
        firstName: 'Reviews',
        lastName: 'Admin',
      },
    });
    const staffToken = await loginStaff(app, admin.email!, adminPassword);

    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ studioId: studio.id, comment: 'Не должен пройти' });
    expect(res.status).toBe(403);
  });

  it('returns 400 if studio cannot be inferred (user without studioId, no body fields)', async () => {
    const { accessToken } = await loginClient(app);
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ comment: 'Хороший визит, спасибо!' });
    expect(res.status).toBe(400);
  });

  it('creates a review and returns it back; uses user.studioId by default', async () => {
    const { studio } = await seedStudio(prisma, 'Default');
    const { accessToken, userId } = await loginClient(app);
    await prisma.user.update({ where: { id: userId }, data: { studioId: studio.id } });

    const create = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        comment: 'Очень понравился визит, спасибо специалисту!',
        ratings: { overall: 5, specialist: 5 },
        allowPublish: true,
      });
    expect(create.status).toBe(201);
    expect(create.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        userId,
        studioId: studio.id,
        appointmentId: null,
        comment: 'Очень понравился визит, спасибо специалисту!',
        allowPublish: true,
        ratings: { overall: 5, specialist: 5 },
      }),
    );
    expect(typeof create.body.createdAt).toBe('string');

    const persisted = await prisma.feedbackSurvey.findUnique({
      where: { id: create.body.id },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.studioId).toBe(studio.id);
    expect(persisted?.allowPublish).toBe(true);

    const list = await request(app.getHttpServer())
      .get('/api/v1/reviews/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(create.body.id);
  });

  it('returns 404 for unknown studioId', async () => {
    const { accessToken } = await loginClient(app);
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        studioId: '00000000-0000-0000-0000-000000000000',
        comment: 'Отзыв без визита, но со студией',
      });
    expect(res.status).toBe(404);
  });
});
