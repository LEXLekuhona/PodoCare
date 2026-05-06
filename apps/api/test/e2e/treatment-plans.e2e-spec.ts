import { UserRole } from '@srs/shared-types';
import argon2 from 'argon2';
import { addMinutes } from 'date-fns';
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

async function loginClientByOtp(app: INestApplication, phone: string): Promise<string> {
  const requestOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone });
  expect(requestOtp.status).toBe(201);

  const verifyOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({
    phone,
    code: requestOtp.body.debugCode,
    deviceType: 'mobile_android',
  });
  expect(verifyOtp.status).toBe(201);
  return verifyOtp.body.tokens.accessToken as string;
}

describe('Treatment plans + protocols (e2e)', () => {
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

  it('specialist creates protocol + treatment plan, client reads own plan', async () => {
    const network = await prisma.network.create({ data: { name: 'Net TP', slug: 'net-tp' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio TP',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const specialistPassword = 'StrongPass123!';
    const specialistUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79993330001',
        email: 'spec-tp@solodova-recovery.local',
        passwordHash: await argon2.hash(specialistPassword),
        firstName: 'Spec',
        lastName: 'TP',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: {
        userId: specialistUser.id,
        studioId: studio.id,
      },
    });
    await prisma.specialistStudio.create({
      data: { specialistProfileId: specialist.id, studioId: studio.id },
    });
    const service = await prisma.service.create({
      data: {
        studioId: studio.id,
        name: 'Consultation',
        durationMinutes: 60,
        priceMinor: 200000,
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79993330002',
        firstName: 'Client',
        lastName: 'TP',
      },
    });
    const slotStart = addMinutes(new Date(), 180);
    await prisma.specialistShift.create({
      data: {
        specialistId: specialist.id,
        studioId: studio.id,
        startsAt: addMinutes(slotStart, -90),
        endsAt: addMinutes(slotStart, 180),
      },
    });
    const specialistToken = await loginStaff(app, specialistUser.email!, specialistPassword);

    const appointment = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: slotStart.toISOString(),
      });
    expect(appointment.status).toBe(201);

    const protocol = await request(app.getHttpServer())
      .post(`/api/v1/appointments/${appointment.body.id}/protocol`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({
        proceduresDone: ['Аппаратная обработка'],
        diagnosis: 'Онихолизис легкой степени',
        materialsUsed: 'Антисептик',
        internalNote: 'Контроль через 2 недели',
        clientVisible: true,
        reason: 'Закрытие визита',
      });
    expect(protocol.status).toBe(201);
    expect(protocol.body.clientVisible).toBe(true);

    const plan = await request(app.getHttpServer())
      .post(`/api/v1/clients/${client.id}/treatment-plans`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({
        appointmentId: appointment.body.id,
        title: 'Домашний план ухода',
        validFrom: new Date().toISOString(),
        steps: [
          {
            title: 'Обрабатывать стопы антисептиком',
            recommendation: '2 раза в день',
            status: 'PENDING',
          },
        ],
        reason: 'После первичного приема',
      });
    expect(plan.status).toBe(201);
    expect(plan.body.steps).toHaveLength(1);

    const clientToken = await loginClientByOtp(app, client.phone);
    const myPlans = await request(app.getHttpServer())
      .get('/api/v1/me/treatment-plans')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(myPlans.status).toBe(200);
    expect(myPlans.body).toHaveLength(1);
    expect(myPlans.body[0]).toEqual(
      expect.objectContaining({
        id: plan.body.id,
        title: 'Домашний план ухода',
      }),
    );
  });

  it('enforces security for foreign client and foreign-network staff', async () => {
    const networkA = await prisma.network.create({ data: { name: 'Net A', slug: 'net-a-tp' } });
    const studioA = await prisma.studio.create({
      data: {
        networkId: networkA.id,
        name: 'Studio A',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const specialistPassword = 'StrongPass123!';
    const specialistUser = await prisma.user.create({
      data: {
        studioId: studioA.id,
        role: UserRole.Specialist,
        phone: '+79994440001',
        email: 'spec-a@solodova-recovery.local',
        passwordHash: await argon2.hash(specialistPassword),
        firstName: 'Spec',
        lastName: 'A',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: {
        userId: specialistUser.id,
        studioId: studioA.id,
      },
    });
    await prisma.specialistStudio.create({
      data: { specialistProfileId: specialist.id, studioId: studioA.id },
    });
    const clientA = await prisma.user.create({
      data: {
        studioId: studioA.id,
        role: UserRole.Client,
        phone: '+79994440002',
        firstName: 'Client',
        lastName: 'A',
      },
    });
    const specialistToken = await loginStaff(app, specialistUser.email!, specialistPassword);
    const plan = await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientA.id}/treatment-plans`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({
        title: 'Plan A',
        validFrom: new Date().toISOString(),
        steps: [{ title: 'Шаг 1' }],
      });
    expect(plan.status).toBe(201);

    const otherClient = await prisma.user.create({
      data: {
        studioId: studioA.id,
        role: UserRole.Client,
        phone: '+79994440003',
        firstName: 'Client',
        lastName: 'B',
      },
    });
    const otherClientToken = await loginClientByOtp(app, otherClient.phone);
    const forbiddenClientRead = await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientA.id}/treatment-plans`)
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(forbiddenClientRead.status).toBe(403);

    const networkB = await prisma.network.create({ data: { name: 'Net B', slug: 'net-b-tp' } });
    const studioB = await prisma.studio.create({
      data: {
        networkId: networkB.id,
        name: 'Studio B',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const adminBPassword = 'StrongPass123!';
    const adminB = await prisma.user.create({
      data: {
        studioId: studioB.id,
        role: UserRole.StudioAdmin,
        phone: '+79994440009',
        email: 'admin-b@solodova-recovery.local',
        passwordHash: await argon2.hash(adminBPassword),
        firstName: 'Admin',
        lastName: 'B',
      },
    });
    const adminBToken = await loginStaff(app, adminB.email!, adminBPassword);
    const forbiddenPatch = await request(app.getHttpServer())
      .patch(`/api/v1/clients/${clientA.id}/treatment-plans/${plan.body.id}`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ comment: 'Попытка редактирования чужой сети' });
    expect(forbiddenPatch.status).toBe(403);
  });
});
