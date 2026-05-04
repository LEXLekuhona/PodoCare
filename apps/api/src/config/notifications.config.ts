import { registerAs } from '@nestjs/config';

export interface NotificationsConfig {
  smsProvider: 'console' | 'sms_ru';
  smsRuApiId?: string;
  smsDefaultSender?: string;
  queueName: string;
}

export default registerAs<NotificationsConfig>('notifications', () => ({
  smsProvider:
    process.env.SMS_PROVIDER === 'sms_ru' || process.env.SMS_PROVIDER === 'console'
      ? process.env.SMS_PROVIDER
      : 'console',
  smsRuApiId: process.env.SMS_RU_API_ID,
  smsDefaultSender: process.env.SMS_DEFAULT_SENDER,
  queueName: process.env.NOTIFICATIONS_QUEUE_NAME ?? 'notifications',
}));
