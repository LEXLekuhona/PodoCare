/* eslint-disable import/order */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  SmsProvider as SharedSmsProvider,
} from '@srs/shared-types';


import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATIONS_SMS_JOB,
  type SendSmsJobData,
  type SendSmsJobResult,
} from '../../application/notifications.jobs';
import { SMS_PROVIDER_TOKEN, type SmsProvider } from '../providers/sms-provider.port';

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
  ) {
    super();
  }

  async process(job: Job<SendSmsJobData>): Promise<SendSmsJobResult> {
    if (job.name !== NOTIFICATIONS_SMS_JOB) {
      throw new Error(`Unknown notifications job: ${job.name}`);
    }

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
    if (this.shouldSuppress(job.data.type, preference)) {
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

  private shouldSuppress(
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
