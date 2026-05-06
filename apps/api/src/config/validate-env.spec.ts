import { randomBytes } from 'node:crypto';

import { envSchema, validateEnv } from './validate-env';

describe('validateEnv', () => {
  const validEnv = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://user:pass@localhost:5433/db',
    JWT_ACCESS_SECRET: randomBytes(48).toString('base64'),
    JWT_REFRESH_SECRET: randomBytes(48).toString('base64'),
    DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  };

  it('принимает корректный env и возвращает типизированный объект', () => {
    const parsed = validateEnv(validEnv);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.API_PORT).toBe(3000);
  });

  it('применяет значения по умолчанию', () => {
    const parsed = validateEnv(validEnv);
    expect(parsed.API_HOST).toBe('0.0.0.0');
    expect(parsed.OTP_PROVIDER).toBe('console');
    expect(parsed.JWT_ACCESS_EXPIRES).toBe('15m');
    expect(parsed.OTP_CODE_LENGTH).toBe(6);
  });

  it('бросает понятную ошибку при пропуске обязательной переменной', () => {
    const broken = { ...validEnv, DATABASE_URL: undefined };
    expect(() => validateEnv(broken)).toThrow(/DATABASE_URL/);
  });

  it('бросает ошибку при слишком коротком JWT_ACCESS_SECRET', () => {
    const broken = { ...validEnv, JWT_ACCESS_SECRET: 'short' };
    expect(() => validateEnv(broken)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('schema экспортируется и работает safeParse', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });
});
