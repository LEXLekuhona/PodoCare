import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  type HealthIndicatorResult
} from '@nestjs/terminus';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  APPOINTMENTS_QUEUE,
  APPOINTMENT_LIFECYCLE_JOB_PREFIX,
} from '../appointments/application/appointments.jobs';
import { NOTIFICATIONS_QUEUE, REMINDER_JOB_ID_PREFIX } from '../notifications/application/notifications.jobs';

import type { Queue } from 'bullmq';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(HealthCheckService)
    private readonly health: HealthCheckService,
    @Inject(PrismaHealthIndicator)
    private readonly prismaIndicator: PrismaHealthIndicator,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RedisService)
    private readonly redis: RedisService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue,
    @InjectQueue(APPOINTMENTS_QUEUE) private readonly appointmentsQueue: Queue,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Проверка работоспособности сервиса и зависимостей' })
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('postgres', this.prisma),
      async (): Promise<HealthIndicatorResult> => {
        const ok = await this.redis.ping();
        return { redis: { status: ok ? 'up' : 'down' } };
      },
      async (): Promise<HealthIndicatorResult> => {
        const counts = await this.notificationsQueue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
          'completed',
        );
        return {
          notificationsQueue: {
            status: 'up',
            counts,
          },
        };
      },
      async (): Promise<HealthIndicatorResult> => {
        const counts = await this.appointmentsQueue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
          'completed',
        );
        return {
          appointmentsQueue: {
            status: 'up',
            counts,
          },
        };
      },
    ]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (для Kubernetes)' })
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('queues')
  @ApiOperation({ summary: 'Smoke-снимок очередей reminders и lifecycle jobs.' })
  async queues() {
    const [notificationsDelayed, appointmentsDelayed] = await Promise.all([
      this.notificationsQueue.getJobs(['delayed']),
      this.appointmentsQueue.getJobs(['delayed']),
    ]);
    const reminderDelayedJobs = notificationsDelayed.filter((job) =>
      String(job.id).startsWith(`${REMINDER_JOB_ID_PREFIX}_`),
    ).length;
    const lifecycleDelayedJobs = appointmentsDelayed.filter((job) =>
      String(job.id).startsWith(`${APPOINTMENT_LIFECYCLE_JOB_PREFIX}_`),
    ).length;

    const reminderDelayedWarnThreshold = this.configService.get<number>(
      'app.queueAlerts.reminderDelayedWarn',
      100,
    );
    const reminderDelayedCriticalThreshold = this.configService.get<number>(
      'app.queueAlerts.reminderDelayedCritical',
      300,
    );
    const lifecycleDelayedWarnThreshold = this.configService.get<number>(
      'app.queueAlerts.lifecycleDelayedWarn',
      50,
    );
    const lifecycleDelayedCriticalThreshold = this.configService.get<number>(
      'app.queueAlerts.lifecycleDelayedCritical',
      150,
    );

    const breaches: string[] = [];
    if (reminderDelayedJobs >= reminderDelayedCriticalThreshold) {
      breaches.push('notifications.reminderDelayedJobs>=critical');
    } else if (reminderDelayedJobs >= reminderDelayedWarnThreshold) {
      breaches.push('notifications.reminderDelayedJobs>=warn');
    }
    if (lifecycleDelayedJobs >= lifecycleDelayedCriticalThreshold) {
      breaches.push('appointments.lifecycleDelayedJobs>=critical');
    } else if (lifecycleDelayedJobs >= lifecycleDelayedWarnThreshold) {
      breaches.push('appointments.lifecycleDelayedJobs>=warn');
    }

    const status = breaches.some((x) => x.endsWith('critical'))
      ? 'critical'
      : breaches.length > 0
        ? 'warn'
        : 'ok';
    const actions =
      status === 'ok'
        ? []
        : [
            'Проверить GET /api/v1/health и убедиться, что Redis/очереди доступны.',
            'Проверить failed/active/delayed counts в queues и конкретные job id по affected appointment.',
            'При деградации workers: перезапустить воркеры, затем запустить ручной smoke create/reschedule/cancel.',
          ];

    return {
      status,
      notifications: {
        queue: NOTIFICATIONS_QUEUE,
        reminderDelayedJobs,
      },
      appointments: {
        queue: APPOINTMENTS_QUEUE,
        lifecycleDelayedJobs,
      },
      alerts: {
        thresholds: {
          reminderDelayedWarn: reminderDelayedWarnThreshold,
          reminderDelayedCritical: reminderDelayedCriticalThreshold,
          lifecycleDelayedWarn: lifecycleDelayedWarnThreshold,
          lifecycleDelayedCritical: lifecycleDelayedCriticalThreshold,
        },
        breaches,
        reaction: actions,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
