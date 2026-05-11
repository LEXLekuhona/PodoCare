import type {
  NotificationTemplateKey,
  NotificationType,
  SmsProvider as SharedSmsProvider,
} from '@srs/shared-types';

export const NOTIFICATIONS_QUEUE = 'notifications';
export const NOTIFICATIONS_SMS_JOB = 'sms.send';
export const NOTIFICATIONS_PUSH_JOB = 'push.send';
export const REMINDER_JOB_ID_PREFIX = 'appointment-reminder';

export interface SendSmsJobData {
  userId: string;
  type: NotificationType;
  templateKey?: NotificationTemplateKey;
  title: string;
  body: string;
  recipient: string;
  senderId?: string;
  payload?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  idempotencyKey?: string;
  reminderPolicyId?: string;
  scheduledFor?: string;
}

export interface SendSmsJobResult {
  provider: SharedSmsProvider;
  providerMessageId: string;
}

export interface SendPushJobData {
  userId: string;
  type: NotificationType;
  templateKey?: NotificationTemplateKey;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  idempotencyKey?: string;
  reminderPolicyId?: string;
  scheduledFor?: string;
}

export interface SendPushJobResult {
  providerMessageId: string;
}
