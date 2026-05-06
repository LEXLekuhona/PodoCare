import { UserRole } from '@srs/shared-types';
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

async function loginClient(app: INestApplication, phone: string): Promise<string> {
  const requestOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({
    phone,
  });
  expect(requestOtp.status).toBe(201);
  const verifyOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({
    phone,
    code: requestOtp.body.debugCode,
    deviceType: 'mobile_android',
  });
  expect(verifyOtp.status).toBe(201);
  return verifyOtp.body.tokens.accessToken as string;
}

describe('Admin catalog (e2e)', () => {
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

  it('enforces 401/403 for admin modules', async () => {
    const noAuthAdminCatalog = await request(app.getHttpServer()).get('/api/v1/admin/catalog/networks');
    expect(noAuthAdminCatalog.status).toBe(401);

    const noAuthAdminEducation = await request(app.getHttpServer()).get('/api/v1/admin/education/series');
    expect(noAuthAdminEducation.status).toBe(401);

    const clientToken = await loginClient(app, '+79991009999');
    const forbiddenAdminCatalog = await request(app.getHttpServer())
      .get('/api/v1/admin/catalog/networks')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(forbiddenAdminCatalog.status).toBe(403);

    const forbiddenAdminEducation = await request(app.getHttpServer())
      .get('/api/v1/admin/education/series')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(forbiddenAdminEducation.status).toBe(403);
  });

  it('enforces auth contract for key protected admin endpoints (401/403)', async () => {
    const clientToken = await loginClient(app, '+79991009998');
    const fakeId = '11111111-1111-1111-1111-111111111111';
    const checks: Array<{
      path: string;
      method: 'get' | 'post' | 'patch' | 'delete';
      body?: Record<string, unknown>;
    }> = [
      { method: 'get', path: '/api/v1/admin/catalog/networks' },
      { method: 'get', path: '/api/v1/admin/catalog/service-categories' },
      { method: 'post', path: '/api/v1/admin/catalog/service-categories', body: {} },
      { method: 'patch', path: `/api/v1/admin/catalog/service-categories/${fakeId}`, body: {} },
      { method: 'delete', path: `/api/v1/admin/catalog/service-categories/${fakeId}` },
      { method: 'get', path: '/api/v1/admin/catalog/specialists' },
      { method: 'post', path: '/api/v1/admin/catalog/specialists', body: {} },
      { method: 'post', path: `/api/v1/admin/catalog/specialists/${fakeId}/shifts/bulk`, body: {} },
      { method: 'get', path: '/api/v1/admin/education/series' },
      { method: 'post', path: '/api/v1/admin/education/series', body: {} },
    ];

    for (const check of checks) {
      const noAuth = await request(app.getHttpServer())[check.method](check.path).send(check.body ?? {});
      expect(noAuth.status).toBe(401);

      const forbidden = await request(app.getHttpServer())[check.method](check.path)
        .set('Authorization', `Bearer ${clientToken}`)
        .send(check.body ?? {});
      expect(forbidden.status).toBe(403);
    }
  });

  it('manages service categories', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net SC', slug: 'net-sc' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio SC',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const password = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.NetworkOwner,
        phone: '+79991000001',
        email: 'owner-sc@solodova-recovery.local',
        passwordHash: await argon2.hash(password),
        firstName: 'Owner',
        lastName: 'SC',
      },
    });
    const token = await loginStaff(app, admin.email!, password);

    const create = await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/service-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Подология',
        slug: 'podology',
        color: '#2D6A4F',
        sortOrder: 5,
      });
    expect(create.status).toBe(201);
    expect(create.body.slug).toBe('podology');

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/catalog/service-categories')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.some((x: { id: string }) => x.id === create.body.id)).toBe(true);
  });

  it('manages physical good categories and goods', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net PG', slug: 'net-pg' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio PG',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const password = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.NetworkOwner,
        phone: '+79991000002',
        email: 'owner-pg@solodova-recovery.local',
        passwordHash: await argon2.hash(password),
        firstName: 'Owner',
        lastName: 'PG',
      },
    });
    const token = await loginStaff(app, admin.email!, password);

    const createCategory = await request(app.getHttpServer())
      .post(`/api/v1/admin/catalog/networks/${network.id}/physical-good-categories`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'care',
        name: 'Уход',
        sortOrder: 0,
      });
    expect(createCategory.status).toBe(201);

    const createGood = await request(app.getHttpServer())
      .post(`/api/v1/admin/catalog/networks/${network.id}/physical-goods`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: 'PG-001',
        slug: 'foot-cream',
        name: 'Крем для стоп',
        categoryId: createCategory.body.id,
        priceRubles: 1290,
        imageUrls: ['https://example.com/good.jpg'],
      });
    expect(createGood.status).toBe(201);
    expect(createGood.body.priceMinor).toBe(129000);

    const listGoods = await request(app.getHttpServer())
      .get(`/api/v1/admin/catalog/networks/${network.id}/physical-goods`)
      .set('Authorization', `Bearer ${token}`);
    expect(listGoods.status).toBe(200);
    expect(listGoods.body.some((x: { id: string }) => x.id === createGood.body.id)).toBe(true);
  });

  it('manages specialist shifts', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net SH', slug: 'net-sh' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio SH',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });

    const ownerPassword = 'StrongPass123!';
    const owner = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.NetworkOwner,
        phone: '+79991000003',
        email: 'owner-sh@solodova-recovery.local',
        passwordHash: await argon2.hash(ownerPassword),
        firstName: 'Owner',
        lastName: 'SH',
      },
    });
    const token = await loginStaff(app, owner.email!, ownerPassword);

    const specialistPassword = 'StrongPass123!';
    const createSpecialist = await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/specialists')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'specialist-sh@solodova-recovery.local',
        password: specialistPassword,
        phone: '+79991000004',
        firstName: 'Spec',
        lastName: 'Shift',
        studioIds: [studio.id],
      });
    expect(createSpecialist.status).toBe(201);

    const now = new Date();
    const startsAt = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 8 * 60 * 60 * 1000);
    const createShift = await request(app.getHttpServer())
      .post(`/api/v1/admin/catalog/specialists/${createSpecialist.body.id}/shifts`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        studioId: studio.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
    expect(createShift.status).toBe(201);

    const listShifts = await request(app.getHttpServer())
      .get(`/api/v1/admin/catalog/specialists/${createSpecialist.body.id}/shifts`)
      .set('Authorization', `Bearer ${token}`);
    expect(listShifts.status).toBe(200);
    expect(listShifts.body.some((x: { id: string }) => x.id === createShift.body.id)).toBe(true);
  });
});
