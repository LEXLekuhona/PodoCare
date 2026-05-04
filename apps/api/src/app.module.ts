import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import appConfig from './config/app.config';
import appointmentsConfig from './config/appointments.config';
import dbConfig from './config/database.config';
import educationConfig from './config/education.config';
import jwtConfig from './config/jwt.config';
import notificationsConfig from './config/notifications.config';
import redisConfig from './config/redis.config';
import { validateEnv } from './config/validate-env';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AdminCatalogModule } from './modules/admin-catalog/admin-catalog.module';
import { AdminEducationModule } from './modules/admin-education/admin-education.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { EducationModule } from './modules/education/education.module';
import { FaqModule } from './modules/faq/faq.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StudiosModule } from './modules/studios/studios.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [
        appConfig,
        appointmentsConfig,
        dbConfig,
        educationConfig,
        jwtConfig,
        notificationsConfig,
        redisConfig,
      ],
      validate: validateEnv,
    }),

    LoggerModule.forRootAsync({
      useFactory: () => ({
        /** Именованный splat для Express 5 / path-to-regexp v8 — иначе `*` даёт WARN LegacyRouteConverter. */
        forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
        pinoHttp: {
          level: process.env.LOG_LEVEL ?? 'info',
          transport:
            process.env.LOG_PRETTY === 'true'
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
                }
              : undefined,
          autoLogging: true,
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.pin',
              'req.body.code',
              'req.body.otp',
            ],
            censor: '[REDACTED]',
          },
          customProps: (req) => ({
            requestId: (req as { id?: string }).id,
          }),
        },
      }),
    }),

    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: (Number(process.env.THROTTLE_TTL_SECONDS) || 60) * 1000,
          limit: Number(process.env.THROTTLE_LIMIT) || 100,
        },
      ],
    }),

    ScheduleModule.forRoot(),

    PrismaModule,
    RedisModule,

    AuthModule,
    AppointmentsModule,
    UsersModule,
    StudiosModule,
    ContentModule,
    EducationModule,
    AdminEducationModule,
    AdminCatalogModule,
    FaqModule,
    HealthModule,
    NotificationsModule,
  ],
})
export class AppModule {}
