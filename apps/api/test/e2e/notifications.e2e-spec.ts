import { NotificationChannel, NotificationTemplateKey, NotificationType, UserRole } from '@srs/shared-types';
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

async function waitFor<T>(
  probe: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 5000,
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
    const studio = await prisma.studio.create({
      data: {
        networkId: network.id,
        name: 'Studio A',
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
        phone: '+79991110001',
        email: 'notify-admin@solodova-recovery.local',
        passwordHash: await argon2.hash(adminPassword),
        firstName: 'Notify',
        lastName: 'Admin',
      },
    });
    const client = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79991110002',
        firstName: 'Notify',
        lastName: 'Client',
      },
    });

    const noAuthCreate = await request(app.getHttpServer())
      .post('/api/v1/notifications/templates')
      .send({
        networkId: network.id,
        key: NotificationTemplateKey.AuthOtp,
        channel: NotificationChannel.Sms,
        body: 'Ваш код: {{otp.code}}',
        variables: ['otp.code'],
      });
    expect(noAuthCreate.status).toBe(401);

    const staffAccessToken = await loginStaff(app, admin.email!, adminPassword);
    const clientAccessToken = await loginClientByOtp(app, client.phone);

    const createTemplate = await request(app.getHttpServer())
      .post('/api/v1/notifications/templates')
      .set('Authorization', `Bearer ${staffAccessToken}`)
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
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .query({ networkId: network.id, channel: NotificationChannel.Sms });
    expect(listTemplates.status).toBe(200);
    expect(listTemplates.body).toHaveLength(1);
    expect(listTemplates.body[0].key).toBe(NotificationTemplateKey.AuthOtp);

    const forbiddenCreate = await request(app.getHttpServer())
      .post('/api/v1/notifications/templates')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({
        networkId: network.id,
        key: NotificationTemplateKey.AuthOtp,
        channel: NotificationChannel.Sms,
        body: 'Ваш код: {{otp.code}}',
        variables: ['otp.code'],
      });
    expect(forbiddenCreate.status).toBe(403);

    const createPolicy = await request(app.getHttpServer())
      .post('/api/v1/notifications/reminder-policies')
      .set('Authorization', `Bearer ${staffAccessToken}`)
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
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .query({ networkId: network.id });
    expect(listPolicies.status).toBe(200);
    expect(listPolicies.body).toHaveLength(1);

    const noAuthTemplateList = await request(app.getHttpServer()).get('/api/v1/notifications/templates');
    expect(noAuthTemplateList.status).toBe(401);

    const noAuthTemplatePatch = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/templates/${createTemplate.body.id}`)
      .send({ body: 'updated' });
    expect(noAuthTemplatePatch.status).toBe(401);

    const noAuthPoliciesList = await request(app.getHttpServer()).get('/api/v1/notifications/reminder-policies');
    expect(noAuthPoliciesList.status).toBe(401);

    const noAuthPolicyPatch = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/reminder-policies/${createPolicy.body.id}`)
      .send({ offsetMinutesBefore: 30 });
    expect(noAuthPolicyPatch.status).toBe(401);

    const noAuthSendSms = await request(app.getHttpServer()).post('/api/v1/notifications/send-sms').send({
      userId: client.id,
      type: NotificationType.System,
      body: 'no auth',
      idempotencyKey: 'e2e-no-auth-send-sms',
    });
    expect(noAuthSendSms.status).toBe(401);

    const forbiddenTemplateList = await request(app.getHttpServer())
      .get('/api/v1/notifications/templates')
      .set('Authorization', `Bearer ${clientAccessToken}`);
    expect(forbiddenTemplateList.status).toBe(403);

    const forbiddenTemplatePatch = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/templates/${createTemplate.body.id}`)
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({ body: 'forbidden' });
    expect(forbiddenTemplatePatch.status).toBe(403);

    const forbiddenPolicyCreate = await request(app.getHttpServer())
      .post('/api/v1/notifications/reminder-policies')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({
        networkId: network.id,
        templateKey: NotificationTemplateKey.AppointmentReminder1h,
        channel: NotificationChannel.Sms,
        offsetMinutesBefore: 30,
      });
    expect(forbiddenPolicyCreate.status).toBe(403);

    const forbiddenPolicyList = await request(app.getHttpServer())
      .get('/api/v1/notifications/reminder-policies')
      .set('Authorization', `Bearer ${clientAccessToken}`);
    expect(forbiddenPolicyList.status).toBe(403);

    const forbiddenPolicyPatch = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/reminder-policies/${createPolicy.body.id}`)
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({ offsetMinutesBefore: 25 });
    expect(forbiddenPolicyPatch.status).toBe(403);

    const forbiddenSendSms = await request(app.getHttpServer())
      .post('/api/v1/notifications/send-sms')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({
        userId: client.id,
        type: NotificationType.System,
        body: 'forbidden',
        idempotencyKey: 'e2e-forbidden-send-sms',
      });
    expect(forbiddenSendSms.status).toBe(403);
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
    const adminPassword = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.StudioAdmin,
        phone: '+79992223340',
        email: 'notify-admin-b@solodova-recovery.local',
        passwordHash: await argon2.hash(adminPassword),
        firstName: 'Notify',
        lastName: 'AdminB',
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
    const staffAccessToken = await loginStaff(app, admin.email!, adminPassword);

    const queued = await request(app.getHttpServer())
      .post('/api/v1/notifications/send-sms')
      .set('Authorization', `Bearer ${staffAccessToken}`)
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
    const adminPassword = 'StrongPass123!';
    const admin = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.StudioAdmin,
        phone: '+79994445560',
        email: 'notify-admin-suppress@solodova-recovery.local',
        passwordHash: await argon2.hash(adminPassword),
        firstName: 'Supp',
        lastName: 'Admin',
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
    const otherUser = await prisma.user.create({
      data: {
        studioId: studio.id,
        role: UserRole.Client,
        phone: '+79994445567',
        firstName: 'Other',
        lastName: 'User',
      },
    });

    const clientAccessToken = await loginClientByOtp(app, user.phone);
    const otherClientToken = await loginClientByOtp(app, otherUser.phone);
    const staffAccessToken = await loginStaff(app, admin.email!, adminPassword);

    const preferenceUpsert = await request(app.getHttpServer())
      .post('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({
        userId: user.id,
        reminderSmsEnabled: false,
      });
    expect(preferenceUpsert.status).toBe(201);
    expect(preferenceUpsert.body.reminderSmsEnabled).toBe(false);

    const getPreference = await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .query({ userId: user.id });
    expect(getPreference.status).toBe(200);
    expect(getPreference.body.reminderSmsEnabled).toBe(false);

    const forbiddenUpdate = await request(app.getHttpServer())
      .post('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${otherClientToken}`)
      .send({
        userId: user.id,
        reminderSmsEnabled: true,
      });
    expect(forbiddenUpdate.status).toBe(403);

    const forbiddenGetPreference = await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${otherClientToken}`)
      .query({ userId: user.id });
    expect(forbiddenGetPreference.status).toBe(403);

    const forbiddenPushDevice = await request(app.getHttpServer())
      .post('/api/v1/notifications/push-devices')
      .set('Authorization', `Bearer ${otherClientToken}`)
      .send({
        userId: user.id,
        provider: 'EXPO',
        token: 'ExpoPushToken[FORBIDDEN_PREF]',
        deviceType: 'mobile_android',
      });
    expect(forbiddenPushDevice.status).toBe(403);

    const queued = await request(app.getHttpServer())
      .post('/api/v1/notifications/send-sms')
      .set('Authorization', `Bearer ${staffAccessToken}`)
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
    const clientAccessToken = await loginClientByOtp(app, user.phone);

    const noAuth = await request(app.getHttpServer())
      .post('/api/v1/notifications/push-devices')
      .send({
        userId: user.id,
        provider: 'EXPO',
        token: 'ExpoPushToken[AAA111]',
        deviceType: 'mobile_ios',
        deviceName: 'iPhone',
      });
    expect(noAuth.status).toBe(401);

    const upsert1 = await request(app.getHttpServer())
      .post('/api/v1/notifications/push-devices')
      .set('Authorization', `Bearer ${clientAccessToken}`)
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
      .set('Authorization', `Bearer ${clientAccessToken}`)
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
