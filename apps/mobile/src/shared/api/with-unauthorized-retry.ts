import { ApiError } from '@/shared/api/api-error';

export async function withUnauthorizedRetry<T>(
  attempt: () => Promise<T>,
  recoverFromUnauthorized: () => Promise<boolean>,
): Promise<T> {
  try {
    return await attempt();
  } catch (e: unknown) {
    if (!(e instanceof ApiError) || e.status !== 401) {
      throw e;
    }
    const ok = await recoverFromUnauthorized();
    if (!ok) {
      throw e;
    }
    return await attempt();
  }
}
