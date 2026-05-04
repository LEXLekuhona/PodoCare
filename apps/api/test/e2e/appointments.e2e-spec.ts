import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationChannel, NotificationTemplateKey, UserRole } from '@podocare/shared-types';
import { Queue } from 'bullmq';
import { addMinutes } from 'date-fns';
import request from 'supertest';

import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { buildTestApp } from '../helpers/build-test-app';

async function waitFor<T>(
  probe: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 6000,
): Promise<T> {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
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

    const create = await request(app.getHttpServer())
      .post('/api/v1/appointments')
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

    const create = await request(app.getHttpServer())
      .post('/api/v1/appointments')
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
