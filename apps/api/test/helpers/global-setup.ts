import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

/**
 * Jest globalSetup: поднимает Postgres и Redis в контейнерах ОДИН раз
 * на весь запуск и применяет миграции. Контейнеры останавливаются в
 * global-teardown.ts. Идентификаторы контейнеров сохраняются в
 * globalThis.__TESTCONTAINERS__, откуда их забирает teardown.
 */
export default async function globalSetup(): Promise<void> {
  console.log('\n🐘  Запуск Postgres testcontainer…');
  const postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('srs_test')
    .withUsername('srs')
    .withPassword('srs_test_pwd')
    .start();

  console.log('🧠  Запуск Redis testcontainer…');
  const redis = await new RedisContainer('redis:7-alpine').start();

  const databaseUrl = postgres.getConnectionUri();
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  process.env.DATABASE_URL = databaseUrl;
  process.env.TEST_DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = redisUrl;
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.JWT_ACCESS_SECRET = randomBytes(48).toString('base64');
  process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  process.env.OTP_PROVIDER = 'console';
  process.env.API_GLOBAL_PREFIX = 'api/v1';

  console.log('🏗  Применение миграций Prisma…');
  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  // Jest globalSetup runs in a separate process — persist env for test workers and teardown.
  const infoPath = join(process.cwd(), '.testcontainers.json');
  writeFileSync(
    infoPath,
    JSON.stringify(
      {
        postgresId: postgres.getId(),
        redisId: redis.getId(),
        env: {
          DATABASE_URL: databaseUrl,
          TEST_DATABASE_URL: databaseUrl,
          REDIS_URL: redisUrl,
          NODE_ENV: 'test',
          LOG_LEVEL: 'silent',
          JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
          JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
          DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
          OTP_PROVIDER: 'console',
          API_GLOBAL_PREFIX: 'api/v1',
        },
      },
      null,
      2,
    ),
    'utf8',
  );
}
