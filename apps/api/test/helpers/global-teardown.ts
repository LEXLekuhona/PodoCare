import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getContainerRuntimeClient } from 'testcontainers';

/** Jest globalTeardown: останавливает поднятые в globalSetup контейнеры. */
export default async function globalTeardown(): Promise<void> {
  const infoPath = join(process.cwd(), '.testcontainers.json');
  let raw: string;
  try {
    raw = readFileSync(infoPath, 'utf8');
  } catch {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object') return;
  const o = parsed as { postgresId?: unknown; redisId?: unknown };
  const postgresId = typeof o.postgresId === 'string' ? o.postgresId : null;
  const redisId = typeof o.redisId === 'string' ? o.redisId : null;
  if (!postgresId && !redisId) return;

  const client = await getContainerRuntimeClient();
  const stop = async (id: string) => {
    const container = client.container.getById(id);
    await client.container.stop(container);
  };
  await Promise.allSettled([
    ...(postgresId ? [stop(postgresId)] : []),
    ...(redisId ? [stop(redisId)] : []),
  ]);
}
