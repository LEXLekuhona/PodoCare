import { rotateRefreshToken, getAccessToken } from '@/features/auth/session-store';

import { ApiError } from '@/shared/api/api-error';
import { apiFetchJson, type ApiFetchInit } from '@/shared/api/client';
import { withUnauthorizedRetry } from '@/shared/api/with-unauthorized-retry';

export async function apiFetchJsonAuth<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const attempt = () =>
    apiFetchJson<T>(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      },
    });

  return withUnauthorizedRetry(attempt, rotateRefreshToken);
}
