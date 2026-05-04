import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@podocare/shared-types';
import argon2 from 'argon2';
import request from 'supertest';

import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { buildTestApp } from '../helpers/build-test-app';

describe('Auth (e2e)', () => {
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

  it('OTP flow: request -> verify -> refresh -> logout', async () => {
    const requestOtp = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({
        phone: '+7 (999) 111-22-33',
        firstName: 'Анна',
        lastName: 'Петрова',
      });

    expect(requestOtp.status).toBe(201);
    expect(requestOtp.body.expiresAt).toBeTruthy();
    expect(requestOtp.body.resendAvailableAt).toBeTruthy();
    expect(requestOtp.body.codeLength).toBe(6);
    expect(typeof requestOtp.body.debugCode).toBe('string');

    const verifyOtp = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({
        phone: '+79991112233',
        code: requestOtp.body.debugCode,
        deviceType: 'mobile_ios',
      });

    expect(verifyOtp.status).toBe(201);
    expect(verifyOtp.body.user.phone).toBe('+79991112233');
    expect(verifyOtp.body.user.role).toBe(UserRole.Client);
    expect(typeof verifyOtp.body.tokens.accessToken).toBe('string');
    expect(typeof verifyOtp.body.tokens.refreshToken).toBe('string');

    const refresh1 = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: verifyOtp.body.tokens.refreshToken });
    expect(refresh1.status).toBe(201);
    expect(refresh1.body.refreshToken).not.toBe(verifyOtp.body.tokens.refreshToken);

    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: refresh1.body.refreshToken });
    expect(logout.status).toBe(204);

    const refreshAfterLogout = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refresh1.body.refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it('staff login by email + password', async () => {
    const network = await prisma.network.create({
      data: {
        name: 'Тестовая сеть',
        slug: 'test-network',
      },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Центральная студия',
        address: 'ул. Пушкина, 1',
        city: 'Москва',
        openingHours: {},
      },
    });

    const password = 'StrongPass123!';
    await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.StudioAdmin,
        phone: '+79990000001',
        email: 'admin@podocare.local',
        passwordHash: await argon2.hash(password),
        firstName: 'Admin',
        lastName: 'User',
      },
    });

    const badAttempt = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({
        email: 'admin@podocare.local',
        password: 'wrong-password',
        deviceType: 'admin_web',
      });
    expect(badAttempt.status).toBe(401);

    const okAttempt = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({
        email: 'admin@podocare.local',
        password,
        deviceType: 'admin_web',
      });
    expect(okAttempt.status).toBe(201);
    expect(okAttempt.body.user.role).toBe(UserRole.StudioAdmin);
    expect(typeof okAttempt.body.tokens.accessToken).toBe('string');
    expect(typeof okAttempt.body.tokens.refreshToken).toBe('string');
  });
});
