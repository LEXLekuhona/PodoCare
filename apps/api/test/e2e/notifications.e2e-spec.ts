import type { INestApplication } from '@nestjs/common';
import { NotificationChannel, NotificationTemplateKey, NotificationType, UserRole } from '@podocare/shared-types';
import request from 'supertest';

import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { buildTestApp } from '../helpers/build-test-app';

async function waitFor<T>(
  probe: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 5000,
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

describe('Notifications (e2e)', () => {
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

  it('creates template + reminder policy and lists them', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net A', slug: 'net-a' },
    });

    const createTemplate = await request(app.getHttpServer())
      .post('/api/v1/notifications/templates')
      .send({
        networkId: network.id,
        key: NotificationTemplateKey.AuthOtp,
        channel: NotificationChannel.Sms,
        body: 'Ваш код: {{otp.code}}',
        variables: ['otp.code'],
      });
    expect(createTemplate.status).toBe(201);
    expect(createTemplate.body.networkId).toBe(network.id);

    const listTemplates = await request(app.getHttpServer())
      .get('/api/v1/notifications/templates')
      .query({ networkId: network.id, channel: NotificationChannel.Sms });
    expect(listTemplates.status).toBe(200);
    expect(listTemplates.body).toHaveLength(1);
    expect(listTemplates.body[0].key).toBe(NotificationTemplateKey.AuthOtp);

    const createPolicy = await request(app.getHttpServer())
      .post('/api/v1/notifications/reminder-policies')
      .send({
        networkId: network.id,
        templateKey: NotificationTemplateKey.AppointmentReminder1h,
        channel: NotificationChannel.Sms,
        offsetMinutesBefore: 60,
      });
    expect(createPolicy.status).toBe(201);
    expect(createPolicy.body.offsetMinutesBefore).toBe(60);

    const listPolicies = await request(app.getHttpServer())
      .get('/api/v1/notifications/reminder-policies')
      .query({ networkId: network.id });
    expect(listPolicies.status).toBe(200);
    expect(listPolicies.body).toHaveLength(1);
  });

  it('queues and sends SMS via worker, writes Notification log', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net B', slug: 'net-b' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio B',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const user = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79992223344',
        firstName: 'Иван',
        lastName: 'Клиентов',
      },
    });

    const queued = await request(app.getHttpServer())
      .post('/api/v1/notifications/send-sms')
      .send({
        userId: user.id,
        type: NotificationType.System,
        body: 'Тестовое уведомление',
        idempotencyKey: 'e2e-notification-1',
      });
    expect(queued.status).toBe(201);
    expect(queued.body.status).toBe('QUEUED');
    expect(queued.body.jobId).toBeTruthy();

    const notification = await waitFor(
      () =>
        prisma.notification.findUnique({
          where: { idempotencyKey: 'e2e-notification-1' },
        }),
      (entry) => Boolean(entry && entry.status === 'SENT'),
      6000,
    );

    expect(notification).toBeTruthy();
    expect(notification?.recipient).toBe(user.phone);
    expect(notification?.status).toBe('SENT');
    expect(notification?.providerMessageId).toBeTruthy();
  });

  it('suppresses SMS when reminderSmsEnabled = false', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net Suppress', slug: 'net-suppress' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio Suppress',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const user = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79994445566',
        firstName: 'Supp',
        lastName: 'User',
      },
    });

    const preferenceUpsert = await request(app.getHttpServer())
      .post('/api/v1/notifications/preferences')
      .send({
        userId: user.id,
        reminderSmsEnabled: false,
      });
    expect(preferenceUpsert.status).toBe(201);
    expect(preferenceUpsert.body.reminderSmsEnabled).toBe(false);

    const getPreference = await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .query({ userId: user.id });
    expect(getPreference.status).toBe(200);
    expect(getPreference.body.reminderSmsEnabled).toBe(false);

    const queued = await request(app.getHttpServer())
      .post('/api/v1/notifications/send-sms')
      .send({
        userId: user.id,
        type: NotificationType.AppointmentReminder,
        body: 'Напоминание о визите',
        idempotencyKey: 'e2e-suppressed-1',
      });
    expect(queued.status).toBe(201);

    const notification = await waitFor(
      () =>
        prisma.notification.findUnique({
          where: { idempotencyKey: 'e2e-suppressed-1' },
        }),
      (entry) => Boolean(entry && entry.status === 'SUPPRESSED'),
      6000,
    );

    expect(notification?.status).toBe('SUPPRESSED');
  });

  it('upserts push device token', async () => {
    const network = await prisma.network.create({
      data: { name: 'Net Push', slug: 'net-push' },
    });
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio Push',
        address: 'Address',
        city: 'Moscow',
        openingHours: {},
      },
    });
    const user = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79993332211',
        firstName: 'Push',
        lastName: 'User',
      },
    });

    const upsert1 = await request(app.getHttpServer())
      .post('/api/v1/notifications/push-devices')
      .send({
        userId: user.id,
        provider: 'EXPO',
        token: 'ExpoPushToken[AAA111]',
        deviceType: 'mobile_ios',
        deviceName: 'iPhone',
      });
    expect(upsert1.status).toBe(201);
    expect(upsert1.body.provider).toBe('EXPO');

    const upsert2 = await request(app.getHttpServer())
      .post('/api/v1/notifications/push-devices')
      .send({
        userId: user.id,
        provider: 'EXPO',
        token: 'ExpoPushToken[AAA111]',
        deviceType: 'mobile_ios',
        deviceName: 'iPhone 2',
      });
    expect(upsert2.status).toBe(201);
    expect(upsert2.body.deviceName).toBe('iPhone 2');

    const count = await prisma.pushDevice.count({
      where: { token: 'ExpoPushToken[AAA111]' },
    });
    expect(count).toBe(1);
  });
});
