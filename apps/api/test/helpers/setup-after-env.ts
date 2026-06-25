/**
 * Запускается перед каждым тестовым файлом. Настраиваем таймауты
 * и общие матчеры при необходимости.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import 'reflect-metadata';

jest.setTimeout(60_000);

// globalSetup runs in a separate Jest process — load testcontainer env for workers.
const infoPath = join(process.cwd(), '.testcontainers.json');
try {
  const raw = readFileSync(infoPath, 'utf8');
  const parsed = JSON.parse(raw) as { env?: Record<string, string> };
  if (parsed.env && typeof parsed.env === 'object') {
    for (const [key, value] of Object.entries(parsed.env)) {
      if (typeof value === 'string' && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
} catch {
  // Local runs may use apps/api/.env instead of testcontainers.
}

// В e2e/integration тестах часто делаем много auth-запросов подряд.
// Поднимаем лимиты троттлинга, чтобы не ловить 429 из ThrottlerGuard.
process.env.THROTTLE_LIMIT = process.env.THROTTLE_LIMIT ?? '100000';
process.env.THROTTLE_TTL_SECONDS = process.env.THROTTLE_TTL_SECONDS ?? '60';
process.env.API_GLOBAL_PREFIX = process.env.API_GLOBAL_PREFIX ?? 'api/v1';
