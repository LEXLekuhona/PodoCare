import { getQueueToken } from '@nestjs/bullmq';
import { AppointmentStatus } from '@prisma/client';
import { NotificationChannel, NotificationTemplateKey, UserRole } from '@srs/shared-types';
import argon2 from 'argon2';
import { addMinutes } from 'date-fns';
import request from 'supertest';

import { APPOINTMENT_AUTO_NO_SHOW_JOB } from '../../src/modules/appointments/application/appointments.jobs';
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

  it('auto no-show job completes stale IN_PROGRESS appointments after grace', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net F', slug: 'net-f' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio F',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const specialistUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79990040001',
        firstName: 'Spec',
        lastName: 'Four',
      },
    });
    const specialist = await prisma.specialistProfile.create({
      data: {
        userId: specialistUser.id,
        studioId: studio.id,
      },
    });
    const service = await prisma.service.create({
      data: {
        studioId: studio.id,
        name: 'Service F',
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
        lastName: 'Four',
      },
    });

    const endsAt = addMinutes(new Date(), -20);
    const startsAt = addMinutes(endsAt, -30);
    const appt = await prisma.appointment.create({
      data: {
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt,
        endsAt,
        status: AppointmentStatus.IN_PROGRESS,
        totalMinor: 100000,
      },
    });

    await appointmentsQueue.add(APPOINTMENT_AUTO_NO_SHOW_JOB, { appointmentId: appt.id }, { delay: 0 });

    const updated = await waitFor(
      () => prisma.appointment.findUnique({ where: { id: appt.id } }),
      (row) => Boolean(row && row.status === 'COMPLETED' && row.completedAt),
      7000,
    );
    expect(updated?.status).toBe('COMPLETED');
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
    const otherClient = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79990035003',
        firstName: 'Other',
        lastName: 'Client',
      },
    });
    const forbiddenCreate = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({
        studioId: studio.id,
        specialistId: specialist.id,
        serviceId: service.id,
        clientUserId: otherClient.id,
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

  it('specialist appointment list is scoped to own profile and allowed studios', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net SpecList', slug: 'net-spec-list' },
    });
    const studioA = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio A',
        address: 'A',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const studioB = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio B',
        address: 'B',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const adminPassword = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studioA.id,
        role: UserRole.StudioAdmin,
        phone: '+79990050099',
        email: 'studio-admin-spec-list@solodova-recovery.local',
        passwordHash: await argon2.hash(adminPassword),
        firstName: 'Studio',
        lastName: 'Admin',
      },
    });
    const specPassword = 'StrongPass123!';
    const specUserA = await prisma.user.create({
      data: {
        studioId: studioA.id,
        role: UserRole.Specialist,
        phone: '+79990050001',
        email: 'spec-a@solodova-recovery.local',
        passwordHash: await argon2.hash(specPassword),
        firstName: 'Spec',
        lastName: 'A',
      },
    });
    const profileA = await prisma.specialistProfile.create({
      data: { userId: specUserA.id, studioId: studioA.id },
    });
    await prisma.specialistStudio.create({
      data: { specialistProfileId: profileA.id, studioId: studioA.id },
    });
    const specUserB = await prisma.user.create({
      data: {
        studioId: studioB.id,
        role: UserRole.Specialist,
        phone: '+79990050002',
        firstName: 'Spec',
        lastName: 'B',
      },
    });
    const profileB = await prisma.specialistProfile.create({
      data: { userId: specUserB.id, studioId: studioB.id },
    });
    await prisma.specialistStudio.create({
      data: { specialistProfileId: profileB.id, studioId: studioB.id },
    });
    const serviceA = await prisma.service.create({
      data: {
        studioId: studioA.id,
        name: 'Svc A',
        durationMinutes: 30,
        priceMinor: 100000,
      },
    });
    const serviceB = await prisma.service.create({
      data: {
        studioId: studioB.id,
        name: 'Svc B',
        durationMinutes: 30,
        priceMinor: 100000,
      },
    });
    const clientA = await prisma.user.create({
      data: {
        studioId: studioA.id,
        role: UserRole.Client,
        phone: '+79990050003',
        firstName: 'Client',
        lastName: 'A',
      },
    });
    const clientB = await prisma.user.create({
      data: {
        studioId: studioB.id,
        role: UserRole.Client,
        phone: '+79990050004',
        firstName: 'Client',
        lastName: 'B',
      },
    });

    const slotA = addMinutes(new Date(), 120);
    const slotB = addMinutes(new Date(), 180);
    await prisma.specialistShift.createMany({
      data: [
        {
          specialistId: profileA.id,
          studioId: studioA.id,
          startsAt: addMinutes(slotA, -60),
          endsAt: addMinutes(slotA, 120),
        },
        {
          specialistId: profileB.id,
          studioId: studioB.id,
          startsAt: addMinutes(slotB, -60),
          endsAt: addMinutes(slotB, 120),
        },
      ],
    });

    const adminToken = await loginStaff(app, admin.email!, adminPassword);

    const apptA = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studioId: studioA.id,
        specialistId: profileA.id,
        serviceId: serviceA.id,
        clientUserId: clientA.id,
        startsAt: slotA.toISOString(),
      });
    expect(apptA.status).toBe(201);

    const apptB = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studioId: studioB.id,
        specialistId: profileB.id,
        serviceId: serviceB.id,
        clientUserId: clientB.id,
        startsAt: slotB.toISOString(),
      });
    expect(apptB.status).toBe(201);

    const specToken = await loginStaff(app, specUserA.email!, specPassword);

    const listOwn = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${specToken}`)
      .query({ from: addMinutes(new Date(), -60).toISOString(), to: addMinutes(new Date(), 600).toISOString() });
    expect(listOwn.status).toBe(200);
    expect(listOwn.body.map((x: { id: string }) => x.id)).toEqual([apptA.body.id]);

    const listAlienStudio = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${specToken}`)
      .query({
        studioId: studioB.id,
        from: addMinutes(new Date(), -60).toISOString(),
        to: addMinutes(new Date(), 600).toISOString(),
      });
    expect(listAlienStudio.status).toBe(403);

    const listAlienSpecialist = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${specToken}`)
      .query({
        specialistId: profileB.id,
        from: addMinutes(new Date(), -60).toISOString(),
        to: addMinutes(new Date(), 600).toISOString(),
      });
    expect(listAlienSpecialist.status).toBe(403);
  });

  it('specialist cannot create appointment for another specialist profile', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net Cr', slug: 'net-cr' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio Cr',
        address: 'A',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const pass = 'StrongPass123!';
    const specAUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79990060001',
        email: 'spec-a-cr@solodova-recovery.local',
        passwordHash: await argon2.hash(pass),
        firstName: 'A',
        lastName: 'A',
      },
    });
    const specBUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79990060002',
        email: 'spec-b-cr@solodova-recovery.local',
        passwordHash: await argon2.hash(pass),
        firstName: 'B',
        lastName: 'B',
      },
    });
    const profileA = await prisma.specialistProfile.create({
      data: { userId: specAUser.id, studioId: studio.id },
    });
    const profileB = await prisma.specialistProfile.create({
      data: { userId: specBUser.id, studioId: studio.id },
    });
    await prisma.specialistStudio.createMany({
      data: [
        { specialistProfileId: profileA.id, studioId: studio.id },
        { specialistProfileId: profileB.id, studioId: studio.id },
      ],
    });
    const service = await prisma.service.create({
      data: {
        studioId: studio.id,
        name: 'Svc Cr',
        durationMinutes: 30,
        priceMinor: 100000,
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79990060003',
        firstName: 'Cl',
        lastName: 'Cl',
      },
    });
    const slotStart = addMinutes(new Date(), 240);
    await prisma.specialistShift.create({
      data: {
        specialistId: profileA.id,
        studioId: studio.id,
        startsAt: addMinutes(slotStart, -60),
        endsAt: addMinutes(slotStart, 120),
      },
    });
    const tokenB = await loginStaff(app, specBUser.email!, pass);
    const forbidden = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        studioId: studio.id,
        specialistId: profileA.id,
        serviceId: service.id,
        clientUserId: client.id,
        startsAt: slotStart.toISOString(),
        source: 'STUDIO',
      });
    expect(forbidden.status).toBe(403);
  });

  it('walk-in clients: 401 without token', async () => {
    const get = await request(app.getHttpServer()).get('/api/v1/appointments/walk-in-clients').query({
      studioId: '00000000-0000-0000-0000-000000000001',
      q: '12',
    });
    expect(get.status).toBe(401);
    const post = await request(app.getHttpServer()).post('/api/v1/appointments/walk-in-clients').send({});
    expect(post.status).toBe(401);
  });

  it('walk-in clients: 403 for client role', async () => {
    const network = await prisma.network.create({ data: { name: 'NW', slug: 'nw-wi' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'SW',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79994440001',
        firstName: 'C',
        lastName: 'C',
      },
    });
    const token = await loginClientByOtp(app, client.phone);
    const res = await request(app.getHttpServer())
      .post('/api/v1/appointments/walk-in-clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        studioId: studio.id,
        firstName: 'Иван',
        lastName: 'Тестов',
        phone: '+79994440002',
      });
    expect(res.status).toBe(403);
  });

  it('walk-in: staff creates client, visit invoice attaches order to walkIn', async () => {
    const network = await prisma.network.create({ data: { name: 'NWI', slug: 'n-wi' } });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'SWI',
        address: 'a',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const pass = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.StudioAdmin,
        phone: '+79995550001',
        email: 'admin-wi@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'Ad',
        lastName: 'Ad',
      },
    });
    const specUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Specialist,
        phone: '+79995550002',
        email: 'spec-wi@local.test',
        passwordHash: await argon2.hash(pass),
        firstName: 'Sp',
        lastName: 'Sp',
      },
    });
    const spec = await prisma.specialistProfile.create({
      data: { userId: specUser.id, studioId: studio.id },
    });
    await prisma.specialistStudio.create({
      data: { specialistProfileId: spec.id, studioId: studio.id },
    });
    const service = await prisma.service.create({
      data: { studioId: studio.id, name: 'S wi', durationMinutes: 30, priceMinor: 15000 },
    });
    const walkIn = await prisma.walkInClient.create({
      data: {
        studioId: studio.id,
        firstName: 'Пётр',
        lastName: 'WalkIn',
        phone: '+79995550003',
      },
    });
    const appt = await prisma.appointment.create({
      data: {
        studioId: studio.id,
        specialistId: spec.id,
        serviceId: service.id,
        walkInClientId: walkIn.id,
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
        totalMinor: 15000,
        status: AppointmentStatus.COMPLETED,
      },
    });
    const token = await loginStaff(app, admin.email!, pass);
    const inv = await request(app.getHttpServer())
      .post('/api/v1/orders/visit-invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({
        appointmentId: appt.id,
        items: [{ productType: 'SERVICE', serviceId: service.id, quantity: 1 }],
      });
    expect(inv.status).toBe(201);
    expect(inv.body.walkInClientId).toBe(walkIn.id);
    expect(inv.body.userId).toBeNull();
  });
});
