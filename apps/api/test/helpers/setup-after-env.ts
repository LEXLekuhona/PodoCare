/**
 * Запускается перед каждым тестовым файлом. Настраиваем таймауты
 * и общие матчеры при необходимости.
 */
import 'reflect-metadata';

jest.setTimeout(60_000);

// В e2e/integration тестах часто делаем много auth-запросов подряд.
// Поднимаем лимиты троттлинга, чтобы не ловить 429 из ThrottlerGuard.
process.env.THROTTLE_LIMIT = process.env.THROTTLE_LIMIT ?? '100000';
process.env.THROTTLE_TTL_SECONDS = process.env.THROTTLE_TTL_SECONDS ?? '60';
