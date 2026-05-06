import { getQueueToken } from '@nestjs/bullmq';
import { NotificationChannel, NotificationTemplateKey, UserRole } from '@srs/shared-types';
import argon2 from 'argon2';
import { addMinutes } from 'date-fns';
import request from 'supertest';

import { buildTestApp } from '../helpers/build-test-app';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import type { INestApplication } from '@nestjs/common';
import type { Queue } from 'bullmq';

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

async function waitFor<T>(
  probe: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 6000,
): Promise<T> {
  const started = Date.now();
   
  while (true) {
    const value = await probe();
    if (predicate(value)) {
      return value;
    }
    if (Date.now() - started >= timeoutMs) {
      throw new Error(`waitFor timeout after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

describe('Appointments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notificationsQueue: Queue;
  let appointmentsQueue: Queue;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    notificationsQueue = app.get<Queue>(getQueueToken('notifications'));
    appointmentsQueue = app.get<Queue>(getQueueToken('appointments'));
  });

  beforeEach(async () => {
    await prisma.truncateAll();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates appointment, blocks overlap, confirms and cancels', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net C', slug: 'net-c' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio C',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const adminPassword = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.StudioAdmin,
        phone: '+79990010099',
        email: 'studio-admin-c@solodova-recovery.local',
        passwordHash: await argon2.hash(adminPassword),
        firstName: 'Studio',
        lastName: 'Admin',
      },
    });
    const specialistUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79990010001',
        firstName: 'Spec',
        lastName: 'One',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: {
        userId: specialistUser.id,
        studioId: studio.id,
      },
    });
    await prisma.specialistStudio.create({
      data: {
        specialistProfileId: specialist.id,
        studioId: studio.id,
      },
    });
    const service = await prisma.service.create({
      data: {
        studioId: studio.id,
        name: 'Consultation',
        durationMinutes: 60,
        priceMinor: 300000,
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79990010002',
        firstName: 'Client',
        lastName: 'One',
      },
    });

    const slotStart = addMinutes(new Date(), 180);
    await prisma.specialistShift.create({
      data: {
        specialistId: specialist.id,
        studioId: studio.id,
        startsAt: addMinutes(slotStart, -60),
        endsAt: addMinutes(slotStart, 180),
      },
    });

    const staffAccessToken = await loginStaff(app, admin.email!, adminPassword);

    const create = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .send({
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: slotStart.toISOString(),
      });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('PENDING');

    const overlap = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .send({
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: addMinutes(slotStart, 20).toISOString(),
      });
    expect(overlap.status).toBe(409);

    const confirm = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${create.body.id}/confirm`)
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .send({});
    expect(confirm.status).toBe(200);
    expect(confirm.body.status).toBe('CONFIRMED');

    const requestOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({
      phone: client.phone,
    });
    expect(requestOtp.status).toBe(201);
    const verifyOtp = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({
      phone: client.phone,
      code: requestOtp.body.debugCode,
      deviceType: 'mobile_android',
    });
    expect(verifyOtp.status).toBe(201);
    expect(verifyOtp.body.user.id).toBe(client.id);

    const cancel = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${create.body.id}/cancel-by-client`)
      .set('Authorization', `Bearer ${verifyOtp.body.tokens.accessToken as string}`)
      .send({ reason: 'Не успеваю' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELLED_BY_CLIENT');
    expect(cancel.body.cancellationReason).toBe('Не успеваю');

    const list = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .query({
        studioId: studio.id,
        specialistId: specialist.id,
      });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it('schedules reminders and reschedules/revokes jobs', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net D', slug: 'net-d' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio D',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const adminPassword = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.StudioAdmin,
        phone: '+79990020099',
        email: 'studio-admin-d@solodova-recovery.local',
        passwordHash: await argon2.hash(adminPassword),
        firstName: 'Studio',
        lastName: 'Admin',
      },
    });
    const specialistUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79990020001',
        firstName: 'Spec',
        lastName: 'Two',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: {
        userId: specialistUser.id,
        studioId: studio.id,
      },
    });
    await prisma.specialistStudio.create({
      data: {
        specialistProfileId: specialist.id,
        studioId: studio.id,
      },
    });
    const service = await prisma.service.create({
      data: {
        studioId: studio.id,
        name: 'Procedure',
        durationMinutes: 45,
        priceMinor: 400000,
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79990020002',
        firstName: 'Client',
        lastName: 'Two',
      },
    });

    await prisma.notificationTemplate.create({
      data: {
        networkId: network.id,
        key: NotificationTemplateKey.AppointmentReminder1h,
        channel: NotificationChannel.Sms,
        locale: 'ru',
        body: 'Напоминание: {{service.name}} в {{appointment.startsAt}}',
      },
    });
    await prisma.reminderPolicy.create({
      data: {
        networkId: network.id,
        templateKey: NotificationTemplateKey.AppointmentReminder1h,
        channel: NotificationChannel.Sms,
        offsetMinutesBefore: 60,
      },
    });
    await prisma.reminderPolicy.create({
      data: {
        networkId: network.id,
        templateKey: NotificationTemplateKey.AppointmentReminder1h,
        channel: NotificationChannel.Sms,
        offsetMinutesBefore: 15,
        conditions: {
          serviceIds: ['00000000-0000-0000-0000-000000000000'],
        },
      },
    });

    const slotStart = addMinutes(new Date(), 180);
    await prisma.specialistShift.create({
      data: {
        specialistId: specialist.id,
        studioId: studio.id,
        startsAt: addMinutes(slotStart, -120),
        endsAt: addMinutes(slotStart, 300),
      },
    });

    const staffAccessToken = await loginStaff(app, admin.email!, adminPassword);

    const create = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .send({
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: slotStart.toISOString(),
      });
    expect(create.status).toBe(201);

    const delayedAfterCreate = await notificationsQueue.getJobs(['delayed']);
    const createJob = delayedAfterCreate.find((job) =>
      String(job.id).includes(`appointment-reminder_${create.body.id}_`),
    );
    expect(createJob).toBeTruthy();
    const reminderJobsForCreate = delayedAfterCreate.filter((job) =>
      String(job.id).includes(`appointment-reminder_${create.body.id}_`),
    );
    expect(reminderJobsForCreate).toHaveLength(1);
    const lifecycleAfterCreate = await appointmentsQueue.getJobs(['delayed']);
    const lifecycleForCreate = lifecycleAfterCreate.filter((job) =>
      String(job.id).includes(`appointment-lifecycle_${create.body.id}_`),
    );
    expect(lifecycleForCreate).toHaveLength(2);

    const newStart = addMinutes(slotStart, 30);
    const reschedule = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${create.body.id}/reschedule`)
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .send({ startsAt: newStart.toISOString(), reason: 'Перенос теста' });
    expect(reschedule.status).toBe(200);

    const delayedAfterReschedule = await notificationsQueue.getJobs(['delayed']);
    const jobsForAppointment = delayedAfterReschedule.filter((job) =>
      String(job.id).includes(`appointment-reminder_${create.body.id}_`),
    );
    expect(jobsForAppointment).toHaveLength(1);
    expect(String(jobsForAppointment[0]?.id)).toContain(String(newStart.getTime()));
    const lifecycleAfterReschedule = await appointmentsQueue.getJobs(['delayed']);
    const lifecycleForReschedule = lifecycleAfterReschedule.filter((job) =>
      String(job.id).includes(`appointment-lifecycle_${create.body.id}_`),
    );
    expect(lifecycleForReschedule).toHaveLength(2);

    const cancel = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${create.body.id}/cancel-by-studio`)
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .send({ reason: 'Закрытие смены' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELLED_BY_STUDIO');

    const delayedAfterCancel = await notificationsQueue.getJobs(['delayed']);
    const remaining = delayedAfterCancel.filter((job) =>
      String(job.id).includes(`appointment-reminder_${create.body.id}_`),
    );
    expect(remaining).toHaveLength(0);
    const lifecycleAfterCancel = await appointmentsQueue.getJobs(['delayed']);
    const remainingLifecycle = lifecycleAfterCancel.filter((job) =>
      String(job.id).includes(`appointment-lifecycle_${create.body.id}_`),
    );
    expect(remainingLifecycle).toHaveLength(0);
  });

  it('auto-start lifecycle job moves pending appointment to IN_PROGRESS', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net E', slug: 'net-e' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio E',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const adminPassword = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.StudioAdmin,
        phone: '+79990030099',
        email: 'studio-admin-e@solodova-recovery.local',
        passwordHash: await argon2.hash(adminPassword),
        firstName: 'Studio',
        lastName: 'Admin',
      },
    });
    const specialistUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79990030001',
        firstName: 'Spec',
        lastName: 'Three',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: {
        userId: specialistUser.id,
        studioId: studio.id,
      },
    });
    await prisma.specialistStudio.create({
      data: {
        specialistProfileId: specialist.id,
        studioId: studio.id,
      },
    });
    const service = await prisma.service.create({
      data: {
        studioId: studio.id,
        name: 'Past slot service',
        durationMinutes: 30,
        priceMinor: 100000,
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79990030002',
        firstName: 'Client',
        lastName: 'Three',
      },
    });

    const slotStart = new Date(Date.now() + 2_000);
    await prisma.specialistShift.create({
      data: {
        specialistId: specialist.id,
        studioId: studio.id,
        startsAt: addMinutes(slotStart, -30),
        endsAt: addMinutes(slotStart, 90),
      },
    });

    const create = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${await loginStaff(app, admin.email!, adminPassword)}`)
      .send({
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: slotStart.toISOString(),
      });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('PENDING');

    const updated = await waitFor(
      () => prisma.appointment.findUnique({ where: { id: create.body.id } }),
      (appointment) => Boolean(appointment && appointment.status === 'IN_PROGRESS'),
      7000,
    );
    expect(updated?.status).toBe('IN_PROGRESS');
  });

  it('enforces auth contract on protected endpoints (401/403)', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net Security', slug: 'net-security' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio Security',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const adminPassword = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.StudioAdmin,
        phone: '+79990035099',
        email: 'studio-admin-security@solodova-recovery.local',
        passwordHash: await argon2.hash(adminPassword),
        firstName: 'Studio',
        lastName: 'Admin',
      },
    });
    const specialistUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79990035001',
        firstName: 'Spec',
        lastName: 'Security',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: {
        userId: specialistUser.id,
        studioId: studio.id,
      },
    });
    await prisma.specialistStudio.create({
      data: {
        specialistProfileId: specialist.id,
        studioId: studio.id,
      },
    });
    const service = await prisma.service.create({
      data: {
        studioId: studio.id,
        name: 'Security service',
        durationMinutes: 30,
        priceMinor: 150000,
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79990035002',
        firstName: 'Client',
        lastName: 'Security',
      },
    });
    const startsAt = addMinutes(new Date(), 180);
    await prisma.specialistShift.create({
      data: {
        specialistId: specialist.id,
        studioId: studio.id,
        startsAt: addMinutes(startsAt, -60),
        endsAt: addMinutes(startsAt, 120),
      },
    });

    const noAuthCreate = await request(app.getHttpServer()).post('/api/v1/appointments').send({
      studioId: studio.id,
      specialistId: specialist.id,
      serviceId: service.id,
      clientUserId: client.id,
      startsAt: startsAt.toISOString(),
    });
    expect(noAuthCreate.status).toBe(401);

    const clientAccessToken = await loginClientByOtp(app, client.phone);
    const forbiddenCreate = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: startsAt.toISOString(),
      });
    expect(forbiddenCreate.status).toBe(403);

    const staffAccessToken = await loginStaff(app, admin.email!, adminPassword);
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .send({
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: startsAt.toISOString(),
      });
    expect(created.status).toBe(201);

    const forbiddenClientCancelByStaff = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id}/cancel-by-client`)
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .send({ reason: 'forbidden' });
    expect(forbiddenClientCancelByStaff.status).toBe(403);

    const noAuthList = await request(app.getHttpServer()).get('/api/v1/appointments');
    expect(noAuthList.status).toBe(401);

    const noAuthConfirm = await request(app.getHttpServer()).patch(`/api/v1/appointments/${created.body.id}/confirm`);
    expect(noAuthConfirm.status).toBe(401);

    const noAuthReschedule = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id}/reschedule`)
      .send({ startsAt: addMinutes(startsAt, 10).toISOString(), reason: 'no auth' });
    expect(noAuthReschedule.status).toBe(401);

    const noAuthCancelByStudio = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id}/cancel-by-studio`)
      .send({ reason: 'no auth' });
    expect(noAuthCancelByStudio.status).toBe(401);

    const noAuthCancelByClient = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id}/cancel-by-client`)
      .send({ reason: 'no auth' });
    expect(noAuthCancelByClient.status).toBe(401);

    const noAuthNext = await request(app.getHttpServer()).get('/api/v1/appointments/next');
    expect(noAuthNext.status).toBe(401);

    const noAuthBookingSlots = await request(app.getHttpServer())
      .get('/api/v1/appointments/booking-slots')
      .query({
        studioId: studio.id,
        serviceId: service.id,
        specialistId: specialist.id,
        fromDate: new Date().toISOString().slice(0, 10),
      });
    expect(noAuthBookingSlots.status).toBe(401);

    const forbiddenList = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${clientAccessToken}`);
    expect(forbiddenList.status).toBe(403);

    const forbiddenConfirm = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id}/confirm`)
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({});
    expect(forbiddenConfirm.status).toBe(403);

    const forbiddenReschedule = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id}/reschedule`)
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({ startsAt: addMinutes(startsAt, 15).toISOString(), reason: 'forbidden' });
    expect(forbiddenReschedule.status).toBe(403);

    const forbiddenCancelByStudio = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id}/cancel-by-studio`)
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({ reason: 'forbidden' });
    expect(forbiddenCancelByStudio.status).toBe(403);
  });

  it('rejects appointment in the past', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net Past', slug: 'net-past' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio Past',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const adminPassword = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.StudioAdmin,
        phone: '+79990040099',
        email: 'studio-admin-past@solodova-recovery.local',
        passwordHash: await argon2.hash(adminPassword),
        firstName: 'Studio',
        lastName: 'Admin',
      },
    });
    const specialistUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79990040001',
        firstName: 'Spec',
        lastName: 'Past',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: {
        userId: specialistUser.id,
        studioId: studio.id,
      },
    });
    await prisma.specialistStudio.create({
      data: {
        specialistProfileId: specialist.id,
        studioId: studio.id,
      },
    });
    const service = await prisma.service.create({
      data: {
        studioId: studio.id,
        name: 'Past service',
        durationMinutes: 30,
        priceMinor: 100000,
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79990040002',
        firstName: 'Client',
        lastName: 'Past',
      },
    });

    await prisma.specialistShift.create({
      data: {
        specialistId: specialist.id,
        studioId: studio.id,
        startsAt: addMinutes(new Date(), -180),
        endsAt: addMinutes(new Date(), 180),
      },
    });

    const create = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${await loginStaff(app, admin.email!, adminPassword)}`)
      .send({
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: addMinutes(new Date(), -10).toISOString(),
      });
    expect(create.status).toBe(400);
    expect(create.body.message).toContain('в прошлом');
  });
});
