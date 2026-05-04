import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedRedisContainer } from '@testcontainers/redis';

type Containers = {
  postgres: StartedPostgreSqlContainer;
  redis: StartedRedisContainer;
};

/** Jest globalTeardown: останавливает поднятые в globalSetup контейнеры. */
export default async function globalTeardown(): Promise<void> {
  const containers = (globalThis as unknown as { __TESTCONTAINERS__?: Containers })
    .__TESTCONTAINERS__;
  if (!containers) {
    return;
  }
  await Promise.allSettled([containers.postgres.stop(), containers.redis.stop()]);
}
