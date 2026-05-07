import { z } from 'zod';

/**
 * Валидация переменных окружения на старте приложения. Ошибки на этом этапе
 * приводят к падению — это намеренно: лучше упасть сразу, чем работать
 * с недонастроенным приложением.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  API_GLOBAL_PREFIX: z.string().default('api'),
  API_CORS_ORIGINS: z.string().default('*'),
  API_ENABLE_SWAGGER: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  DATABASE_URL: z.string().url(),
  SHADOW_DATABASE_URL: z.string().url().optional(),
  TEST_DATABASE_URL: z.string().url().optional(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('30d'),

  DATA_ENCRYPTION_KEY: z.string().min(32),

  OTP_PROVIDER: z.enum(['console', 'sms_ru', 'smsc', 'sms_aero']).default('console'),

  OTP_CODE_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(60),
  SMS_PROVIDER: z.enum(['console', 'sms_ru']).default('console'),
  SMS_RU_API_ID: z.string().optional(),
  SMS_DEFAULT_SENDER: z.string().optional(),
  NOTIFICATIONS_QUEUE_NAME: z.string().default('notifications'),
  /** `console` — имитация отправки; `expo` — реальные push через Expo Push Service. */
  PUSH_PROVIDER: z.enum(['console', 'expo']).default('console'),
  /** Bearer-токен для Expo Push API (необязательно, но рекомендуется в production). */
  EXPO_ACCESS_TOKEN: z.string().optional(),
  APPOINTMENT_MIN_LEAD_MINUTES: z.coerce.number().int().nonnegative().default(0),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  LOG_PRETTY: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  ALERT_REMINDER_DELAYED_WARN: z.coerce.number().int().nonnegative().default(100),
  ALERT_REMINDER_DELAYED_CRITICAL: z.coerce.number().int().nonnegative().default(300),
  ALERT_LIFECYCLE_DELAYED_WARN: z.coerce.number().int().nonnegative().default(50),
  ALERT_LIFECYCLE_DELAYED_CRITICAL: z.coerce.number().int().nonnegative().default(150),

  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(`Некорректная конфигурация окружения:\n${issues}`);
  }
  return parsed.data;
}
