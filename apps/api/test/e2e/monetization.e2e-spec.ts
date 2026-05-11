import {
  AppointmentStatus,
  DeliveryMethod,
  InstallmentProvider,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  ProgramInquiryStatus,
  ShipmentStatus,
  UserRole,
} from '@prisma/client';
import argon2 from 'argon2';
import request from 'supertest';

import { buildTinkoffToken } from '../../src/modules/monetization/application/payments.service';
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

async function loginClientByOtp(app: INestApplication, phone: string): Promise<string> {
  const requestOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone });
  expect(requestOtp.status).toBe(201);

  const verifyOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({
    phone,
    code: requestOtp.body.debugCode,
    deviceType: 'mobile_ios',
  });
  expect(verifyOtp.status).toBe(201);
  return verifyOtp.body.tokens.accessToken as string;
}

describe('Monetization MVP (e2e)', () => {
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

  it('admin acquiring terminals: 401 without token, 403 for non-superadmin', async () => {
    const noAuth = await request(app.getHttpServer()).get('/api/v1/admin/acquiring-terminals');
    expect(noAuth.status).toBe(401);

    const network = await prisma.network.create({ data: { name: 'AcqN', slug: 'acq-n' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'AcqS',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const pass = 'StrongPass123!';
    const owner = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.NETWORK_OWNER,
        phone: '+79994440001',
        email: 'owner-acq@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'O',
        lastName: 'O',
      },
    });
    const ownerToken = await loginStaff(app, owner.email!, pass);
    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/admin/acquiring-terminals')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('admin acquiring terminals: superadmin can list', async () => {
    const network = await prisma.network.create({ data: { name: 'SAq', slug: 'saq-n' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'SAqS',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const pass = 'StrongPass123!';
    const superUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.SUPER_ADMIN,
        phone: '+79994440002',
        email: 'super-acq@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'S',
        lastName: 'A',
      },
    });
    const token = await loginStaff(app, superUser.email!, pass);
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/acquiring-terminals')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
  });

  it('returns 401 without token on protected monetization routes', async () => {
    const checkout = await request(app.getHttpServer()).post('/api/v1/orders/checkout').send({
      studioId: '00000000-0000-0000-0000-000000000001',
      items: [{ productType: 'PHYSICAL_GOOD', physicalGoodId: '00000000-0000-0000-0000-000000000002', quantity: 1 }],
    });
    expect(checkout.status).toBe(401);

    const inquiries = await request(app.getHttpServer()).get('/api/v1/program-inquiries');
    expect(inquiries.status).toBe(401);

    const instList = await request(app.getHttpServer()).get('/api/v1/installment-requests');
    expect(instList.status).toBe(401);
    const instMine = await request(app.getHttpServer()).get('/api/v1/installment-requests/mine');
    expect(instMine.status).toBe(401);
    const instPost = await request(app.getHttpServer()).post('/api/v1/installment-requests').send({});
    expect(instPost.status).toBe(401);
    const instPatch = await request(app.getHttpServer())
      .patch('/api/v1/installment-requests/00000000-0000-0000-0000-000000000099')
      .send({ status: 'APPROVED' });
    expect(instPatch.status).toBe(401);

    const refund = await request(app.getHttpServer())
      .post('/api/v1/payments/00000000-0000-0000-0000-000000000099/refund')
      .send({ reason: 'test' });
    expect(refund.status).toBe(401);
  });

  it('installment-requests staff routes and payments refund: 403 for client', async () => {
    const network = await prisma.network.create({ data: { name: 'NInst', slug: 'n-inst' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'SInst',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.CLIENT,
        phone: '+79992220001',
        firstName: 'C',
        lastName: 'C',
      },
    });
    const clientToken = await loginClientByOtp(app, client.phone);
    const listStaff = await request(app.getHttpServer())
      .get('/api/v1/installment-requests')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(listStaff.status).toBe(403);
    const patchStaff = await request(app.getHttpServer())
      .patch('/api/v1/installment-requests/00000000-0000-0000-0000-000000000088')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: 'APPROVED' });
    expect(patchStaff.status).toBe(403);
    const refundForbidden = await request(app.getHttpServer())
      .post('/api/v1/payments/00000000-0000-0000-0000-000000000088/refund')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ reason: 'x' });
    expect(refundForbidden.status).toBe(403);
  });

  it('installment-requests POST: 403 for staff (client-only)', async () => {
    const network = await prisma.network.create({ data: { name: 'NInst2', slug: 'n-inst2' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'SInst2',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const pass = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.STUDIO_ADMIN,
        phone: '+79992220002',
        email: 'admin-inst@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'A',
        lastName: 'A',
      },
    });
    const token = await loginStaff(app, admin.email!, pass);
    const res = await request(app.getHttpServer())
      .post('/api/v1/installment-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('returns 403 when client calls staff POS catalog routes', async () => {
    const network = await prisma.network.create({ data: { name: 'N403b', slug: 'n403b' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'S403',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.CLIENT,
        phone: '+79997770099',
        firstName: 'C',
        lastName: 'C',
      },
    });
    const clientToken = await loginClientByOtp(app, client.phone);
    const cat = await request(app.getHttpServer())
      .get('/api/v1/orders/visit-sale-catalog')
      .query({ studioId: studio.id })
      .set('Authorization', `Bearer ${clientToken}`);
    expect(cat.status).toBe(403);
    const byAppt = await request(app.getHttpServer())
      .get(`/api/v1/orders/visit-invoice/by-appointment/00000000-0000-0000-0000-000000000088`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(byAppt.status).toBe(403);
  });

  it('returns 403 when staff of another network patches program inquiry', async () => {
    const netA = await prisma.network.create({ data: { name: 'NA', slug: 'na-m' } });
    const studioA = await prisma.studio.create({
      data: {
        networkId: netA.id,
        name: 'SA',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const adminA = await prisma.user.create({
      data: {
        studioId: studioA.id,
        role: UserRole.STUDIO_ADMIN,
        phone: '+79991110001',
        email: 'admin-a-m@local.test',
        passwordHash: await argon2.hash('StrongPass123!'),
        firstName: 'A',
        lastName: 'A',
      },
    });
    const authorA = adminA;
    const program = await prisma.program.create({
      data: {
        networkId: netA.id,
        authorUserId: authorA.id,
        slug: 'prog-a',
        title: 'Программа A',
        description: 'd',
        durationDays: 10,
        priceMinor: 100000,
        inclusions: [],
        stages: [],
        isPublished: true,
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studioA.id,
        role: UserRole.CLIENT,
        phone: '+79991110002',
        firstName: 'C',
        lastName: 'C',
      },
    });
    const inquiry = await prisma.programInquiry.create({
      data: {
        networkId: netA.id,
        programId: program.id,
        clientUserId: client.id,
        firstName: 'C',
        phone: client.phone,
        status: ProgramInquiryStatus.NEW,
      },
    });

    const netB = await prisma.network.create({ data: { name: 'NB', slug: 'nb-m' } });
    const studioB = await prisma.studio.create({
      data: {
        networkId: netB.id,
        name: 'SB',
        address: 'b',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const adminB = await prisma.user.create({
      data: {
        studioId: studioB.id,
        role: UserRole.STUDIO_ADMIN,
        phone: '+79991110003',
        email: 'admin-b-m@local.test',
        passwordHash: await argon2.hash('StrongPass123!'),
        firstName: 'B',
        lastName: 'B',
      },
    });
    const tokenB = await loginStaff(app, adminB.email!, 'StrongPass123!');

    const forbidden = await request(app.getHttpServer())
      .patch(`/api/v1/program-inquiries/${inquiry.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: ProgramInquiryStatus.IN_PROGRESS });
    expect(forbidden.status).toBe(403);
  });

  it('program inquiry → installment → checkout → pay → webhook idempotency → shipment → refund', async () => {
    const network = await prisma.network.create({ data: { name: 'NM', slug: 'nm' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'SM',
        address: 'x',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const adminPass = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.STUDIO_ADMIN,
        phone: '+79992220001',
        email: 'admin-m@local.test',
        passwordHash: await argon2.hash(adminPass),
        firstName: 'Ad',
        lastName: 'Min',
      },
    });
    const program = await prisma.program.create({
      data: {
        networkId: network.id,
        authorUserId: admin.id,
        slug: 'prog-m',
        title: 'Долгая программа',
        description: 'd',
        durationDays: 90,
        priceMinor: 500000,
        inclusions: [],
        stages: [],
        isPublished: true,
        installmentAvailable: true,
      },
    });
    const category = await prisma.physicalGoodCategory.create({
      data: { networkId: network.id, slug: 'c1', name: 'Уход' },
    });
    const good = await prisma.physicalGood.create({
      data: {
        networkId: network.id,
        categoryId: category.id,
        sku: 'SKU-M1',
        slug: 'cream-m',
        name: 'Крем',
        priceMinor: 15000,
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.CLIENT,
        phone: '+79992220002',
        firstName: 'Cl',
        lastName: 'Ie',
      },
    });

    const clientToken = await loginClientByOtp(app, client.phone);
    const adminToken = await loginStaff(app, admin.email!, adminPass);

    const inq = await request(app.getHttpServer())
      .post('/api/v1/program-inquiries')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        programId: program.id,
        message: 'Хочу записаться',
      });
    expect(inq.status).toBe(201);
    expect(inq.body.status).toBe('NEW');

    const listInq = await request(app.getHttpServer())
      .get('/api/v1/program-inquiries')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listInq.status).toBe(200);
    expect(listInq.body.length).toBe(1);

    const patchInq = await request(app.getHttpServer())
      .patch(`/api/v1/program-inquiries/${inq.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: ProgramInquiryStatus.IN_PROGRESS,
        assignedUserId: admin.id,
        note: 'Позвонить завтра',
      });
    expect(patchInq.status).toBe(200);
    expect(patchInq.body.assignedUserId).toBe(admin.id);

    const inst = await request(app.getHttpServer())
      .post('/api/v1/installment-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        programId: program.id,
        provider: InstallmentProvider.TINKOFF_INSTALLMENT,
        amountMinor: 500000,
        termMonths: 6,
      });
    expect(inst.status).toBe(201);

    const patchInst = await request(app.getHttpServer())
      .patch(`/api/v1/installment-requests/${inst.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });
    expect(patchInst.status).toBe(200);

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        studioId: studio.id,
        deliveryMethod: DeliveryMethod.PICKUP,
        items: [{ productType: 'PHYSICAL_GOOD', physicalGoodId: good.id, quantity: 2 }],
      });
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.totalMinor).toBe(30000);
    expect(orderRes.body.status).toBe('AWAITING_PAYMENT');

    const payRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderRes.body.id}/payments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ method: PaymentMethod.CARD });
    expect(payRes.status).toBe(201);
    expect(payRes.body.provider).toBe('MANUAL');

    await prisma.payment.update({
      where: { id: payRes.body.id },
      data: {
        status: PaymentStatus.PROCESSING,
        provider: PaymentProvider.YOOKASSA,
        providerTxId: 'yoo-e2e-1',
      },
    });

    const webhookBody = {
      type: 'notification',
      event: 'payment.succeeded',
      object: { id: 'yoo-e2e-1', status: 'succeeded' },
    };

    const wh1 = await request(app.getHttpServer()).post('/api/v1/webhooks/yookassa').send(webhookBody);
    expect(wh1.status).toBe(200);
    const wh2 = await request(app.getHttpServer()).post('/api/v1/webhooks/yookassa').send(webhookBody);
    expect(wh2.status).toBe(200);

    const dedupCount = await prisma.processedProviderWebhook.count({
      where: { provider: PaymentProvider.YOOKASSA, externalId: 'payment.succeeded:yoo-e2e-1' },
    });
    expect(dedupCount).toBe(1);

    const paidOrder = await prisma.order.findUnique({ where: { id: orderRes.body.id } });
    expect(paidOrder?.status).toBe(OrderStatus.PAID);

    const shipPatch = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderRes.body.id}/shipment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: ShipmentStatus.IN_TRANSIT, note: 'Передано курьеру' });
    expect(shipPatch.status).toBe(200);
    expect(shipPatch.body.status).toBe('IN_TRANSIT');

    const refund = await request(app.getHttpServer())
      .post(`/api/v1/payments/${payRes.body.id}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect([200, 201]).toContain(refund.status);
    const orderAfter = await prisma.order.findUnique({ where: { id: orderRes.body.id } });
    expect(orderAfter?.status).toBe('REFUNDED');
  });

  it('visit invoice: 401 without token on staff payment routes', async () => {
    const noAuth = await request(app.getHttpServer()).post('/api/v1/orders/visit-invoice').send({});
    expect(noAuth.status).toBe(401);

    const cash = await request(app.getHttpServer())
      .post('/api/v1/orders/00000000-0000-0000-0000-000000000099/visit-payments/cash')
      .send({});
    expect(cash.status).toBe(401);

    const tk = await request(app.getHttpServer())
      .post('/api/v1/orders/00000000-0000-0000-0000-000000000099/visit-payments/tinkoff-init')
      .send({});
    expect(tk.status).toBe(401);

    const catalog = await request(app.getHttpServer()).get('/api/v1/orders/visit-sale-catalog').query({
      studioId: '00000000-0000-0000-0000-000000000099',
    });
    expect(catalog.status).toBe(401);

    const byAppt = await request(app.getHttpServer()).get(
      '/api/v1/orders/visit-invoice/by-appointment/00000000-0000-0000-0000-000000000099',
    );
    expect(byAppt.status).toBe(401);
  });

  it('visit invoice: 403 when another specialist issues invoice', async () => {
    const network = await prisma.network.create({ data: { name: 'VN', slug: 'vn-vi' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'VS',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const pass = 'StrongPass123!';
    const specAUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.SPECIALIST,
        phone: '+79993330001',
        email: 'spec-a-vi@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'A',
        lastName: 'A',
      },
    });
    const specBUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.SPECIALIST,
        phone: '+79993330002',
        email: 'spec-b-vi@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'B',
        lastName: 'B',
      },
    });
    const specA = await prisma.specialistProfile.create({
      data: { userId: specAUser.id, studioId: studio.id },
    });
    const specB = await prisma.specialistProfile.create({
      data: { userId: specBUser.id, studioId: studio.id },
    });
    await prisma.specialistStudio.createMany({
      data: [
        { specialistProfileId: specA.id, studioId: studio.id },
        { specialistProfileId: specB.id, studioId: studio.id },
      ],
    });
    const service = await prisma.service.create({
      data: { studioId: studio.id, name: 'S', durationMinutes: 30, priceMinor: 5000 },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.CLIENT,
        phone: '+79993330003',
        firstName: 'C',
        lastName: 'C',
      },
    });
    const appt = await prisma.appointment.create({
      data: {
        studioId: studio.id,
        specialistId: specA.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
        totalMinor: 5000,
        status: AppointmentStatus.COMPLETED,
      },
    });
    const tokenB = await loginStaff(app, specBUser.email!, pass);
    const forbidden = await request(app.getHttpServer())
      .post('/api/v1/orders/visit-invoice')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        appointmentId: appt.id,
        items: [{ productType: 'SERVICE', serviceId: service.id, quantity: 1 }],
      });
    expect(forbidden.status).toBe(403);
  });

  it('visit invoice: 403 when another specialist records cash payment', async () => {
    const network = await prisma.network.create({ data: { name: 'VN2', slug: 'vn-vi2' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'VS2',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const pass = 'StrongPass123!';
    const specAUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.SPECIALIST,
        phone: '+79993331001',
        email: 'spec-a-cash@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'A',
        lastName: 'A',
      },
    });
    const specBUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.SPECIALIST,
        phone: '+79993331002',
        email: 'spec-b-cash@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'B',
        lastName: 'B',
      },
    });
    const specA = await prisma.specialistProfile.create({
      data: { userId: specAUser.id, studioId: studio.id },
    });
    const specB = await prisma.specialistProfile.create({
      data: { userId: specBUser.id, studioId: studio.id },
    });
    await prisma.specialistStudio.createMany({
      data: [
        { specialistProfileId: specA.id, studioId: studio.id },
        { specialistProfileId: specB.id, studioId: studio.id },
      ],
    });
    const service = await prisma.service.create({
      data: { studioId: studio.id, name: 'S2', durationMinutes: 30, priceMinor: 5000 },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.CLIENT,
        phone: '+79993331003',
        firstName: 'C',
        lastName: 'C',
      },
    });
    const appt = await prisma.appointment.create({
      data: {
        studioId: studio.id,
        specialistId: specA.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
        totalMinor: 5000,
        status: AppointmentStatus.COMPLETED,
      },
    });
    const tokenA = await loginStaff(app, specAUser.email!, pass);
    const tokenB = await loginStaff(app, specBUser.email!, pass);
    const inv = await request(app.getHttpServer())
      .post('/api/v1/orders/visit-invoice')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        appointmentId: appt.id,
        items: [{ productType: 'SERVICE', serviceId: service.id, quantity: 1 }],
      });
    expect(inv.status).toBe(201);
    const cashForbidden = await request(app.getHttpServer())
      .post(`/api/v1/orders/${inv.body.id}/visit-payments/cash`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});
    expect(cashForbidden.status).toBe(403);
  });

  it('visit sale catalog: commerce staff can list services and goods for studio', async () => {
    const network = await prisma.network.create({ data: { name: 'CatN', slug: 'cat-n' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'CatS',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const pass = 'StrongPass123!';
    const specUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.SPECIALIST,
        phone: '+79993332001',
        email: 'spec-cat@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'S',
        lastName: 'S',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: { userId: specUser.id, studioId: studio.id },
    });
    await prisma.specialistStudio.create({
      data: { specialistProfileId: specialist.id, studioId: studio.id },
    });
    await prisma.service.create({
      data: { studioId: studio.id, name: 'SrvCat', durationMinutes: 20, priceMinor: 1000 },
    });
    const category = await prisma.physicalGoodCategory.create({
      data: { networkId: network.id, slug: 'c-cat', name: 'Уход' },
    });
    await prisma.physicalGood.create({
      data: {
        networkId: network.id,
        categoryId: category.id,
        sku: 'SKU-CAT',
        slug: 'g-cat',
        name: 'Крем',
        priceMinor: 500,
        stock: 10,
      },
    });
    const token = await loginStaff(app, specUser.email!, pass);
    const res = await request(app.getHttpServer())
      .get('/api/v1/orders/visit-sale-catalog')
      .query({ studioId: studio.id })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.services)).toBe(true);
    expect(res.body.services.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.physicalGoods)).toBe(true);
    expect(res.body.physicalGoods.length).toBeGreaterThanOrEqual(1);
  });

  it('visit invoice: create, cash payment, client cannot pay online; stock decreases', async () => {
    const network = await prisma.network.create({ data: { name: 'V2', slug: 'v2-vi' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'V2S',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const pass = 'StrongPass123!';
    const specUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.SPECIALIST,
        phone: '+79994440001',
        email: 'spec-v2@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'S',
        lastName: 'S',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: { userId: specUser.id, studioId: studio.id },
    });
    await prisma.specialistStudio.create({
      data: { specialistProfileId: specialist.id, studioId: studio.id },
    });
    const service = await prisma.service.create({
      data: { studioId: studio.id, name: 'Proc', durationMinutes: 45, priceMinor: 10_000 },
    });
    const category = await prisma.physicalGoodCategory.create({
      data: { networkId: network.id, slug: 'cat-v2', name: 'Уход' },
    });
    const good = await prisma.physicalGood.create({
      data: {
        networkId: network.id,
        categoryId: category.id,
        sku: 'SKU-V2',
        slug: 'g-v2',
        name: 'Мазь',
        priceMinor: 3000,
        stock: 99,
      },
    });
    await prisma.physicalGoodStudioInventory.create({
      data: { goodId: good.id, studioId: studio.id, stock: 5, isAvailable: true },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.CLIENT,
        phone: '+79994440002',
        firstName: 'Cl',
        lastName: 'Cl',
      },
    });
    const appt = await prisma.appointment.create({
      data: {
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
        totalMinor: 10_000,
        status: AppointmentStatus.COMPLETED,
      },
    });
    const specToken = await loginStaff(app, specUser.email!, pass);
    const clientToken = await loginClientByOtp(app, client.phone);

    const inv = await request(app.getHttpServer())
      .post('/api/v1/orders/visit-invoice')
      .set('Authorization', `Bearer ${specToken}`)
      .send({
        appointmentId: appt.id,
        items: [
          { productType: 'SERVICE', serviceId: service.id, quantity: 1 },
          { productType: 'PHYSICAL_GOOD', physicalGoodId: good.id, quantity: 2 },
        ],
      });
    expect(inv.status).toBe(201);
    expect(inv.body.totalMinor).toBe(16_000);
    expect(inv.body.appointmentId).toBe(appt.id);

    const blockOnline = await request(app.getHttpServer())
      .post(`/api/v1/orders/${inv.body.id}/payments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ method: PaymentMethod.CARD });
    expect(blockOnline.status).toBe(400);

    const cash = await request(app.getHttpServer())
      .post(`/api/v1/orders/${inv.body.id}/visit-payments/cash`)
      .set('Authorization', `Bearer ${specToken}`)
      .send({});
    expect(cash.status).toBe(201);

    const paid = await prisma.order.findUnique({ where: { id: inv.body.id } });
    expect(paid?.status).toBe(OrderStatus.PAID);

    const invRow = await prisma.physicalGoodStudioInventory.findUnique({
      where: { goodId_studioId: { goodId: good.id, studioId: studio.id } },
    });
    expect(invRow?.stock).toBe(3);
  });

  it('visit invoice: Tinkoff Init + webhook CONFIRMED (mock fetch)', async () => {
    const prevKey = process.env.TINKOFF_TERMINAL_KEY;
    const prevPass = process.env.TINKOFF_PASSWORD;
    process.env.TINKOFF_TERMINAL_KEY = 'TerminalE2E';
    process.env.TINKOFF_PASSWORD = 'SecretE2E';

    const origFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        Success: true,
        ErrorCode: '0',
        TerminalKey: 'TerminalE2E',
        PaymentId: '999888777',
        OrderId: 'placeholder',
        Amount: 1000,
        Status: 'NEW',
      }),
    })) as unknown as typeof fetch;

    try {
      const network = await prisma.network.create({ data: { name: 'TK', slug: 'tk-vi' } });
      const studio = await prisma.studio.create({
        data: {
          networkId: network.id,
          name: 'TKS',
          address: 'a',
          city: 'Moscow',
          openingHours: {},
        },
      });
      const pass = 'StrongPass123!';
      const specUser = await prisma.user.create({
        data: {
          studioId: studio.id,
          role: UserRole.SPECIALIST,
          phone: '+79995550001',
          email: 'spec-tk@local.test',
          passwordHash: await argon2.hash(pass),
          firstName: 'T',
          lastName: 'K',
        },
      });
      const specialist = await prisma.specialistProfile.create({
        data: { userId: specUser.id, studioId: studio.id },
      });
      await prisma.specialistStudio.create({
        data: { specialistProfileId: specialist.id, studioId: studio.id },
      });
      const service = await prisma.service.create({
        data: { studioId: studio.id, name: 'TkS', durationMinutes: 20, priceMinor: 1000 },
      });
      const client = await prisma.user.create({
        data: {
          studioId: studio.id,
          role: UserRole.CLIENT,
          phone: '+79995550002',
          firstName: 'C',
          lastName: 'C',
        },
      });
      const appt = await prisma.appointment.create({
        data: {
          studioId: studio.id,
          specialistId: specialist.id,
          serviceId: service.id,
          clientUserId: client.id,
          startsAt: new Date(Date.now() + 60_000),
          endsAt: new Date(Date.now() + 120_000),
          totalMinor: 1000,
          status: AppointmentStatus.IN_PROGRESS,
        },
      });
      const specToken = await loginStaff(app, specUser.email!, pass);

      const inv = await request(app.getHttpServer())
        .post('/api/v1/orders/visit-invoice')
        .set('Authorization', `Bearer ${specToken}`)
        .send({
          appointmentId: appt.id,
          items: [{ productType: 'SERVICE', serviceId: service.id, quantity: 1 }],
        });
      expect(inv.status).toBe(201);
      const orderId = inv.body.id as string;

      (global.fetch as jest.Mock).mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          Success: true,
          ErrorCode: '0',
          TerminalKey: 'TerminalE2E',
          PaymentId: '999888777',
          OrderId: orderId,
          Amount: 1000,
          Status: 'NEW',
        }),
      }));

      const init = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderId}/visit-payments/tinkoff-init`)
        .set('Authorization', `Bearer ${specToken}`)
        .send({});
      expect(init.status).toBe(201);
      expect(init.body.provider).toBe('TINKOFF');

      const notifBase = {
        TerminalKey: 'TerminalE2E',
        OrderId: orderId,
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: '999888777',
        Amount: 1000,
      };
      const token = buildTinkoffToken(notifBase, 'SecretE2E');
      const wh1 = await request(app.getHttpServer())
        .post('/api/v1/webhooks/tinkoff')
        .send({ ...notifBase, Token: token });
      expect(wh1.status).toBe(200);
      const wh2 = await request(app.getHttpServer())
        .post('/api/v1/webhooks/tinkoff')
        .send({ ...notifBase, Token: token });
      expect(wh2.status).toBe(200);

      const dedup = await prisma.processedProviderWebhook.count({
        where: { provider: PaymentProvider.TINKOFF, externalId: 'tinkoff:confirmed:999888777' },
      });
      expect(dedup).toBe(1);

      const ord = await prisma.order.findUnique({ where: { id: orderId } });
      expect(ord?.status).toBe(OrderStatus.PAID);
    } finally {
      global.fetch = origFetch;
      process.env.TINKOFF_TERMINAL_KEY = prevKey;
      process.env.TINKOFF_PASSWORD = prevPass;
    }
  });
});
