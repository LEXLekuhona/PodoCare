import request from 'supertest';

import { buildTestApp } from '../helpers/build-test-app';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import type { INestApplication } from '@nestjs/common';

describe('Health (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/health/live возвращает ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /api/v1/health проверяет postgres и redis', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.postgres.status).toBe('up');
    expect(res.body.info.redis.status).toBe('up');
    expect(res.body.info.notificationsQueue.status).toBe('up');
    expect(res.body.info.appointmentsQueue.status).toBe('up');
  });

  it('GET /api/v1/health/queues возвращает smoke-снимок reminders и lifecycle jobs', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/queues');
    expect(res.status).toBe(200);
    expect(['ok', 'warn', 'critical']).toContain(res.body.status);
    expect(typeof res.body.notifications.reminderDelayedJobs).toBe('number');
    expect(typeof res.body.appointments.lifecycleDelayedJobs).toBe('number');
    expect(typeof res.body.alerts.thresholds.reminderDelayedWarn).toBe('number');
    expect(Array.isArray(res.body.alerts.breaches)).toBe(true);
    expect(Array.isArray(res.body.alerts.reaction)).toBe(true);
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('проставляет X-Request-Id в ответе', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('использует X-Request-Id из запроса если он есть', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'test-request-id-123');
    expect(res.headers['x-request-id']).toBe('test-request-id-123');
  });

  it('prisma.truncateAll работает (сохраняется чистое состояние БД между тестами)', async () => {
    const userCount = await prisma.user.count();
    expect(userCount).toBe(0);
  });
});
