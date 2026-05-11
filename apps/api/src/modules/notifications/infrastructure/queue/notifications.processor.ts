/* eslint-disable import/order */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PushProvider,
  SmsProvider as SharedSmsProvider,
} from '@srs/shared-types';

import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATIONS_PUSH_JOB,
  NOTIFICATIONS_SMS_JOB,
  type SendPushJobData,
  type SendPushJobResult,
  type SendSmsJobData,
  type SendSmsJobResult,
} from '../../application/notifications.jobs';
import { SMS_PROVIDER_TOKEN, type SmsProvider } from '../providers/sms-provider.port';
import type { PushDeliveryService } from '../push/push-delivery.service';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import type { Job } from 'bullmq';

@Injectable()
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER_TOKEN) private readonly smsProvider: SmsProvider,
    private readonly pushDelivery: PushDeliveryService,
  ) {
    super();
  }

  async process(job: Job<SendSmsJobData | SendPushJobData>): Promise<SendSmsJobResult | SendPushJobResult> {
    if (job.name === NOTIFICATIONS_SMS_JOB) {
      return this.processSms(job as Job<SendSmsJobData>);
    }
    if (job.name === NOTIFICATIONS_PUSH_JOB) {
      return this.processPush(job as Job<SendPushJobData>);
    }
    throw new Error(`Unknown notifications job: ${job.name}`);
  }

  private async processSms(job: Job<SendSmsJobData>): Promise<SendSmsJobResult> {
    const existing = job.data.idempotencyKey
      ? await this.prisma.notification.findUnique({
          where: { idempotencyKey: job.data.idempotencyKey },
        })
      : null;

    if (existing) {
      return {
        provider: (existing.smsProvider as SharedSmsProvider) ?? SharedSmsProvider.Console,
        providerMessageId: existing.providerMessageId ?? existing.id,
      };
    }

    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId: job.data.userId },
    });
    if (this.shouldSuppressSms(job.data.type, preference)) {
      const suppressed = await this.prisma.notification.create({
        data: {
          userId: job.data.userId,
          type: job.data.type,
          templateKey: job.data.templateKey,
          channel: NotificationChannel.Sms,
          status: NotificationStatus.Suppressed,
          title: job.data.title,
          body: job.data.body,
          recipient: job.data.recipient,
          payload: job.data.payload as Prisma.InputJsonValue | undefined,
          entityType: job.data.entityType,
          entityId: job.data.entityId,
          idempotencyKey: job.data.idempotencyKey,
          failureReason: 'Suppressed by notification preferences',
        },
      });
      return {
        provider: SharedSmsProvider.Console,
        providerMessageId: suppressed.id,
      };
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: job.data.userId,
        type: job.data.type,
        templateKey: job.data.templateKey,
        channel: NotificationChannel.Sms,
        status: NotificationStatus.Sending,
        title: job.data.title,
        body: job.data.body,
        recipient: job.data.recipient,
        payload: job.data.payload as Prisma.InputJsonValue | undefined,
        entityType: job.data.entityType,
        entityId: job.data.entityId,
        idempotencyKey: job.data.idempotencyKey,
      },
    });

    try {
      const result = await this.smsProvider.send({
        to: job.data.recipient,
        message: job.data.body,
        senderId: job.data.senderId,
      });

      const provider = this.detectSmsProvider(result.providerPayload);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          smsProvider: provider,
          providerMessageId: result.providerMessageId,
          providerPayload: result.providerPayload as Prisma.InputJsonValue | undefined,
          costMinor: result.costMinor,
          status: NotificationStatus.Sent,
          sentAt: new Date(),
        },
      });

      return { provider, providerMessageId: result.providerMessageId };
    } catch (error) {
      this.logger.error(`SMS send failed for job ${job.id}`, error as Error);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.Failed,
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.message : 'Unknown send error',
        },
      });
      throw error;
    }
  }

  private async processPush(job: Job<SendPushJobData>): Promise<SendPushJobResult> {
    const existing = job.data.idempotencyKey
      ? await this.prisma.notification.findUnique({
          where: { idempotencyKey: job.data.idempotencyKey },
        })
      : null;
    if (existing) {
      return {
        providerMessageId: existing.providerMessageId ?? existing.id,
      };
    }

    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId: job.data.userId },
    });
    if (this.shouldSuppressPush(job.data.type, preference)) {
      const suppressed = await this.prisma.notification.create({
        data: {
          userId: job.data.userId,
          type: job.data.type,
          templateKey: job.data.templateKey,
          channel: NotificationChannel.Push,
          status: NotificationStatus.Suppressed,
          title: job.data.title,
          body: job.data.body,
          recipient: 'push',
          payload: job.data.payload as Prisma.InputJsonValue | undefined,
          entityType: job.data.entityType,
          entityId: job.data.entityId,
          idempotencyKey: job.data.idempotencyKey,
          failureReason: 'Suppressed by notification preferences',
        },
      });
      return { providerMessageId: suppressed.id };
    }

    const usesExpo = this.pushDelivery.usesRealExpoPush();
    const devices = await this.prisma.pushDevice.findMany({
      where: {
        userId: job.data.userId,
        isActive: true,
        ...(usesExpo ? { provider: PushProvider.Expo } : {}),
      },
      select: { token: true, provider: true },
      take: 20,
    });
    const tokens = devices.map((d) => d.token).filter((t) => typeof t === 'string' && t.trim().length > 0);
    if (tokens.length === 0) {
      const suppressed = await this.prisma.notification.create({
        data: {
          userId: job.data.userId,
          type: job.data.type,
          templateKey: job.data.templateKey,
          channel: NotificationChannel.Push,
          status: NotificationStatus.Suppressed,
          title: job.data.title,
          body: job.data.body,
          recipient: 'push',
          payload: job.data.payload as Prisma.InputJsonValue | undefined,
          entityType: job.data.entityType,
          entityId: job.data.entityId,
          idempotencyKey: job.data.idempotencyKey,
          failureReason: 'No active push devices',
        },
      });
      return { providerMessageId: suppressed.id };
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: job.data.userId,
        type: job.data.type,
        templateKey: job.data.templateKey,
        channel: NotificationChannel.Push,
        status: NotificationStatus.Sending,
        title: job.data.title,
        body: job.data.body,
        recipient: tokens[0]!,
        payload: job.data.payload as Prisma.InputJsonValue | undefined,
        entityType: job.data.entityType,
        entityId: job.data.entityId,
        idempotencyKey: job.data.idempotencyKey,
      },
    });

    const data = this.stringifyPushData(job.data.payload);
    try {
      const tickets = await this.pushDelivery.sendExpoTickets(
        tokens.map((to) => ({
          to,
          title: job.data.title,
          body: job.data.body,
          data,
        })),
      );
      const hasError = tickets.some((t) => t.status === 'error');
      const providerMessageId = tickets.find((t) => t.status === 'ok')?.id ?? 'unknown';
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          pushProvider: usesExpo ? PushProvider.Expo : PushProvider.Console,
          providerMessageId,
          providerPayload: { tickets, tokensCount: tokens.length } as Prisma.InputJsonValue,
          status: hasError ? NotificationStatus.Failed : NotificationStatus.Sent,
          sentAt: hasError ? undefined : new Date(),
          failedAt: hasError ? new Date() : undefined,
          failureReason: hasError ? 'Expo push returned error ticket(s)' : undefined,
        },
      });
      if (hasError) {
        throw new Error('Expo push returned error ticket(s)');
      }
      return { providerMessageId };
    } catch (error) {
      this.logger.error(`Push send failed for job ${job.id}`, error as Error);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.Failed,
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.message : 'Unknown send error',
        },
      });
      throw error;
    }
  }

  private shouldSuppressSms(
    type: NotificationType,
    preference: {
      marketingSmsEnabled: boolean;
      reminderSmsEnabled: boolean;
    } | null,
  ): boolean {
    if (!preference) {
      return false;
    }
    if (type === NotificationType.AppointmentReminder && !preference.reminderSmsEnabled) {
      return true;
    }
    if (
      [
        NotificationType.NewContent,
        NotificationType.PromoCodeIssued,
        NotificationType.QuizFollowUp,
      ].includes(type) &&
      !preference.marketingSmsEnabled
    ) {
      return true;
    }
    return false;
  }

  private shouldSuppressPush(
    type: NotificationType,
    preference: {
      marketingPushEnabled: boolean;
      newContentPushEnabled: boolean;
      reminderPushEnabled: boolean;
    } | null,
  ): boolean {
    if (!preference) {
      return false;
    }
    if (type === NotificationType.AppointmentReminder && !preference.reminderPushEnabled) {
      return true;
    }
    if (type === NotificationType.NewContent && !preference.newContentPushEnabled) {
      return true;
    }
    if (
      [NotificationType.PromoCodeIssued, NotificationType.QuizFollowUp].includes(type) &&
      !preference.marketingPushEnabled
    ) {
      return true;
    }
    return false;
  }

  private stringifyPushData(payload?: Record<string, unknown>): Record<string, string> | undefined {
    if (!payload) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined) continue;
      out[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  private detectSmsProvider(payload: unknown): SharedSmsProvider {
    if (
      payload &&
      typeof payload === 'object' &&
      'mode' in payload &&
      (payload as { mode?: string }).mode === 'console'
    ) {
      return SharedSmsProvider.Console;
    }
    return SharedSmsProvider.SmsRu;
  }
}
