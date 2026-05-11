import { triggerSessionExpiredNavigation } from '@/features/auth/session-expired-nav';
import { takeRefreshAuthRejected } from '@/features/auth/session-refresh-state';

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
      if (takeRefreshAuthRejected()) {
        triggerSessionExpiredNavigation();
      }
      throw e;
    }
    return await attempt();
  }
}
