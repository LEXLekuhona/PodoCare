import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

import type { NotificationsConfig } from '../../config/notifications.config';
import { NotificationsService } from './application/notifications.service';
import { NOTIFICATIONS_QUEUE } from './application/notifications.jobs';
import { ConsoleSmsProvider } from './infrastructure/providers/console-sms.provider';
import { SMS_PROVIDER_TOKEN } from './infrastructure/providers/sms-provider.port';
import { SmsRuProvider } from './infrastructure/providers/sms-ru.provider';
import { PushDeliveryService } from './infrastructure/push/push-delivery.service';
import { NotificationsProcessor } from './infrastructure/queue/notifications.processor';
import { NotificationsController } from './presentation/notifications.controller';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.getOrThrow<string>('REDIS_URL');
        const parsed = new URL(redisUrl);
        return {
          connection: {
            host: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : 6379,
            username: parsed.username || undefined,
            password: parsed.password || undefined,
            db: parsed.pathname ? Number(parsed.pathname.slice(1) || '0') : 0,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushDeliveryService,
    NotificationsProcessor,
    ConsoleSmsProvider,
    SmsRuProvider,
    {
      provide: SMS_PROVIDER_TOKEN,
      inject: [ConfigService, ConsoleSmsProvider, SmsRuProvider],
      useFactory: (
        configService: ConfigService,
        consoleProvider: ConsoleSmsProvider,
        smsRuProvider: SmsRuProvider,
      ) => {
        const cfg = configService.getOrThrow<NotificationsConfig>('notifications');
        if (cfg.smsProvider === 'sms_ru') {
          return smsRuProvider;
        }
        return consoleProvider;
      },
    },
  ],
  exports: [NotificationsService, PushDeliveryService, BullModule],
})
export class NotificationsModule {}
