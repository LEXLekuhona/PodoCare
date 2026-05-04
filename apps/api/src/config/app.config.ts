import { registerAs } from '@nestjs/config';

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  host: string;
  globalPrefix: string;
  corsOrigins: string[] | '*';
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
  };
});
