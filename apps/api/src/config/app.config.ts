import { registerAs } from '@nestjs/config';

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  host: string;
  globalPrefix: string;
  corsOrigins: string[] | '*';
  queueAlerts: {
    reminderDelayedWarn: number;
    reminderDelayedCritical: number;
    lifecycleDelayedWarn: number;
    lifecycleDelayedCritical: number;
  };
}

export default registerAs<AppConfig>('app', () => {
  const originsRaw = process.env.API_CORS_ORIGINS ?? '*';
  const corsOrigins: string[] | '*' =
    originsRaw === '*'
      ? '*'
      : originsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

  return {
    env: (process.env.NODE_ENV as AppConfig['env']) ?? 'development',
    port: Number(process.env.API_PORT ?? 3000),
    host: process.env.API_HOST ?? '0.0.0.0',
    globalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api',
    corsOrigins,
    queueAlerts: {
      reminderDelayedWarn: Number(process.env.ALERT_REMINDER_DELAYED_WARN ?? 100),
      reminderDelayedCritical: Number(process.env.ALERT_REMINDER_DELAYED_CRITICAL ?? 300),
      lifecycleDelayedWarn: Number(process.env.ALERT_LIFECYCLE_DELAYED_WARN ?? 50),
      lifecycleDelayedCritical: Number(process.env.ALERT_LIFECYCLE_DELAYED_CRITICAL ?? 150),
    },
  };
});
