import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationTemplateKey,
  NotificationType,
  PushProvider,
  SmsProvider as SharedSmsProvider,
} from '@podocare/shared-types';

import type { NotificationsConfig } from '../../../config/notifications.config';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATIONS_SMS_JOB,
  REMINDER_JOB_ID_PREFIX,
  type SendSmsJobData,
} from './notifications.jobs';
import { type CreateNotificationTemplateDto } from '../presentation/dto/create-notification-template.dto';
import { type CreateReminderPolicyDto } from '../presentation/dto/create-reminder-policy.dto';
import { type SendSmsDto } from '../presentation/dto/send-sms.dto';
import { type UpdateNotificationTemplateDto } from '../presentation/dto/update-notification-template.dto';
import { type UpdateReminderPolicyDto } from '../presentation/dto/update-reminder-policy.dto';
import { type UpsertNotificationPreferenceDto } from '../presentation/dto/upsert-notification-preference.dto';
import { type UpsertPushDeviceDto } from '../presentation/dto/upsert-push-device.dto';

@Injectable()
export class NotificationsService {
  private readonly queueName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue<SendSmsJobData>,
  ) {
    this.queueName = this.configService.getOrThrow<NotificationsConfig>('notifications').queueName;
  }

  async createTemplate(dto: CreateNotificationTemplateDto) {
    await this.ensureNetworkExists(dto.networkId);
    return this.prisma.notificationTemplate.create({
      data: {
        networkId: dto.networkId,
        key: dto.key,
        channel: dto.channel,
        locale: dto.locale ?? 'ru',
        subject: dto.subject,
        body: dto.body,
        variables: dto.variables ?? [],
        senderId: dto.senderId,
        isActive: dto.isActive ?? true,
      },
    });
  }

  listTemplates(params: {
    networkId?: string;
    channel?: NotificationChannel;
    key?: NotificationTemplateKey;
    activeOnly?: boolean;
  }) {
    return this.prisma.notificationTemplate.findMany({
      where: {
        networkId: params.networkId,
        channel: params.channel,
        key: params.key,
        ...(params.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async updateTemplate(id: string, dto: UpdateNotificationTemplateDto) {
    await this.ensureTemplateExists(id);
    if (dto.networkId) {
      await this.ensureNetworkExists(dto.networkId);
    }
    return this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        networkId: dto.networkId,
        key: dto.key,
        channel: dto.channel,
        locale: dto.locale,
        subject: dto.subject,
        body: dto.body,
        variables: dto.variables,
        senderId: dto.senderId,
        isActive: dto.isActive,
      },
    });
  }

  async createReminderPolicy(dto: CreateReminderPolicyDto) {
    await this.ensureNetworkExists(dto.networkId);
    return this.prisma.reminderPolicy.create({
      data: {
        networkId: dto.networkId,
        templateKey: dto.templateKey,
        channel: dto.channel,
        offsetMinutesBefore: dto.offsetMinutesBefore,
        conditions: dto.conditions as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  listReminderPolicies(params: { networkId?: string; activeOnly?: boolean }) {
    return this.prisma.reminderPolicy.findMany({
      where: {
        networkId: params.networkId,
        ...(params.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ offsetMinutesBefore: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async updateReminderPolicy(id: string, dto: UpdateReminderPolicyDto) {
    await this.ensureReminderPolicyExists(id);
    if (dto.networkId) {
      await this.ensureNetworkExists(dto.networkId);
    }
    return this.prisma.reminderPolicy.update({
      where: { id },
      data: {
        networkId: dto.networkId,
        templateKey: dto.templateKey,
        channel: dto.channel,
        offsetMinutesBefore: dto.offsetMinutesBefore,
        conditions: dto.conditions as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive,
      },
    });
  }

  async enqueueSms(dto: SendSmsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, phone: true },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    let messageBody = dto.body ?? '';
    let messageTitle = dto.title ?? '';

    if (dto.templateKey) {
      const template = await this.resolveTemplateForUser(user.id, dto.templateKey, NotificationChannel.Sms);
      if (!template) {
        throw new NotFoundException(`Не найден активный шаблон ${dto.templateKey} для канала SMS`);
      }
      messageBody = messageBody || template.body;
      messageTitle = messageTitle || template.subject || '';
    }

    if (!messageBody.trim()) {
      throw new NotFoundException('Для SMS необходим текст body или templateKey');
    }

    const provider = this.resolveSmsProvider();
    const job = await this.enqueueSmsJob({
      userId: user.id,
      type: dto.type,
      templateKey: dto.templateKey,
      title: messageTitle,
      body: messageBody,
      recipient: user.phone,
      senderId: dto.senderId,
      payload: dto.payload,
      entityType: dto.entityType,
      entityId: dto.entityId,
      idempotencyKey: dto.idempotencyKey,
    });

    return {
      queue: this.queueName,
      jobId: job.id,
      provider,
      status: NotificationStatus.Queued,
    };
  }

  async scheduleAppointmentReminders(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        studio: {
          select: {
            id: true,
            name: true,
            networkId: true,
          },
        },
        specialist: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Запись не найдена');
    }
    if (!appointment.clientUserId || !appointment.client) {
      return { scheduled: 0, skipped: 'no-client-user' };
    }

    const policies = await this.prisma.reminderPolicy.findMany({
      where: {
        networkId: appointment.studio.networkId,
        channel: NotificationChannel.Sms,
        isActive: true,
      },
      orderBy: { offsetMinutesBefore: 'desc' },
    });

    let scheduled = 0;
    const now = Date.now();
    for (const policy of policies) {
      if (
        !this.matchesReminderConditions(policy.conditions, {
          studioId: appointment.studioId,
          serviceId: appointment.serviceId,
        })
      ) {
        continue;
      }

      const template = await this.prisma.notificationTemplate.findFirst({
        where: {
          networkId: appointment.studio.networkId,
          key: policy.templateKey,
          channel: NotificationChannel.Sms,
          locale: 'ru',
          isActive: true,
        },
      });
      if (!template) {
        continue;
      }

      const scheduledAt = new Date(appointment.startsAt.getTime() - policy.offsetMinutesBefore * 60 * 1000);
      const delayMs = Math.max(0, scheduledAt.getTime() - now);
      const templateData: Record<string, string> = {
        'client.firstName': appointment.client.firstName,
        'client.lastName': appointment.client.lastName,
        'studio.name': appointment.studio.name,
        'service.name': appointment.service.name,
        'appointment.startsAt': appointment.startsAt.toISOString(),
        'specialist.firstName': appointment.specialist.user.firstName,
        'specialist.lastName': appointment.specialist.user.lastName,
      };

      const body = this.renderTemplate(template.body, templateData);
      const title = this.renderTemplate(template.subject ?? '', templateData);
      const idempotencyKey = this.buildReminderIdempotencyKey(
        appointment.id,
        policy.id,
        appointment.startsAt,
      );

      await this.enqueueSmsJob(
        {
          userId: appointment.client.id,
          type: NotificationType.AppointmentReminder,
          templateKey: policy.templateKey as NotificationTemplateKey,
          title,
          body,
          recipient: appointment.client.phone,
          senderId: template.senderId ?? undefined,
          entityType: 'appointment',
          entityId: appointment.id,
          idempotencyKey,
          reminderPolicyId: policy.id,
          scheduledFor: scheduledAt.toISOString(),
        },
        {
          delayMs,
          jobId: this.buildReminderJobId(appointment.id, policy.id, appointment.startsAt),
        },
      );
      scheduled += 1;
    }

    return { scheduled };
  }

  async revokeAppointmentReminders(appointmentId: string) {
    const prefix = `${REMINDER_JOB_ID_PREFIX}_${appointmentId}_`;
    const jobs = await this.notificationsQueue.getJobs(['delayed', 'waiting']);
    const appointmentJobs = jobs.filter((job) => String(job.id).startsWith(prefix));
    await Promise.all(appointmentJobs.map((job) => job.remove()));
    return { removed: appointmentJobs.length };
  }

  async getPreference(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
  }

  async upsertPreference(dto: UpsertNotificationPreferenceDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return this.prisma.notificationPreference.upsert({
      where: { userId: dto.userId },
      update: {
        marketingSmsEnabled: dto.marketingSmsEnabled,
        marketingPushEnabled: dto.marketingPushEnabled,
        marketingEmailEnabled: dto.marketingEmailEnabled,
        newContentPushEnabled: dto.newContentPushEnabled,
        reminderSmsEnabled: dto.reminderSmsEnabled,
        reminderPushEnabled: dto.reminderPushEnabled,
        quietHoursStart: dto.quietHoursStart,
        quietHoursEnd: dto.quietHoursEnd,
      },
      create: {
        userId: dto.userId,
        marketingSmsEnabled: dto.marketingSmsEnabled ?? true,
        marketingPushEnabled: dto.marketingPushEnabled ?? true,
        marketingEmailEnabled: dto.marketingEmailEnabled ?? true,
        newContentPushEnabled: dto.newContentPushEnabled ?? true,
        reminderSmsEnabled: dto.reminderSmsEnabled ?? true,
        reminderPushEnabled: dto.reminderPushEnabled ?? true,
        quietHoursStart: dto.quietHoursStart,
        quietHoursEnd: dto.quietHoursEnd,
      },
    });
  }

  async upsertPushDevice(dto: UpsertPushDeviceDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return this.prisma.pushDevice.upsert({
      where: {
        provider_token: {
          provider: dto.provider as PushProvider,
          token: dto.token,
        },
      },
      update: {
        userId: dto.userId,
        deviceType: dto.deviceType,
        deviceName: dto.deviceName,
        isActive: dto.isActive ?? true,
        lastSeenAt: new Date(),
      },
      create: {
        userId: dto.userId,
        provider: dto.provider as PushProvider,
        token: dto.token,
        deviceType: dto.deviceType,
        deviceName: dto.deviceName,
        isActive: dto.isActive ?? true,
      },
    });
  }

  private resolveSmsProvider(): SharedSmsProvider {
    const cfg = this.configService.getOrThrow<NotificationsConfig>('notifications');
    return cfg.smsProvider === 'sms_ru' ? SharedSmsProvider.SmsRu : SharedSmsProvider.Console;
  }

  private async resolveTemplateForUser(
    userId: string,
    key: NotificationTemplateKey,
    channel: NotificationChannel,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { studio: { select: { networkId: true } } },
    });
    const networkId = user?.studio?.networkId;
    if (!networkId) {
      return null;
    }
    return this.prisma.notificationTemplate.findFirst({
      where: {
        networkId,
        key,
        channel,
        locale: 'ru',
        isActive: true,
      },
    });
  }

  private async enqueueSmsJob(
    data: SendSmsJobData,
    options?: {
      delayMs?: number;
      jobId?: string;
    },
  ): Promise<Job<SendSmsJobData>> {
    return this.notificationsQueue.add(NOTIFICATIONS_SMS_JOB, data, {
      jobId: options?.jobId ?? data.idempotencyKey,
      delay: options?.delayMs,
      removeOnComplete: 1000,
      removeOnFail: 1000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  private renderTemplate(source: string, vars: Record<string, string>): string {
    return source.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => {
      const value = vars[key];
      return value !== undefined ? value : match;
    });
  }

  private buildReminderJobId(appointmentId: string, policyId: string, startsAt: Date): string {
    return `${REMINDER_JOB_ID_PREFIX}_${appointmentId}_${policyId}_${startsAt.getTime()}`;
  }

  private buildReminderIdempotencyKey(
    appointmentId: string,
    policyId: string,
    startsAt: Date,
  ): string {
    return this.buildReminderJobId(appointmentId, policyId, startsAt);
  }

  private matchesReminderConditions(
    conditions: Prisma.JsonValue | null,
    ctx: { studioId: string; serviceId: string },
  ): boolean {
    if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) {
      return true;
    }
    const cond = conditions as Record<string, unknown>;
    const studioIds = this.getStringArray(cond.studioIds);
    const serviceIds = this.getStringArray(cond.serviceIds);

    if (studioIds && !studioIds.includes(ctx.studioId)) {
      return false;
    }
    if (serviceIds && !serviceIds.includes(ctx.serviceId)) {
      return false;
    }
    return true;
  }

  private getStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }
    const items = value.filter((item): item is string => typeof item === 'string');
    return items.length > 0 ? items : null;
  }

  private async ensureNetworkExists(networkId: string): Promise<void> {
    const exists = await this.prisma.network.findUnique({
      where: { id: networkId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Сеть не найдена');
    }
  }

  private async ensureTemplateExists(id: string): Promise<void> {
    const exists = await this.prisma.notificationTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Шаблон уведомления не найден');
    }
  }

  private async ensureReminderPolicyExists(id: string): Promise<void> {
    const exists = await this.prisma.reminderPolicy.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('ReminderPolicy не найден');
    }
  }
}
