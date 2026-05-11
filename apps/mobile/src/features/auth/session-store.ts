import * as SecureStore from 'expo-secure-store';

import { clearOfflineAppSnapshots } from '@/features/offline/app-snapshots';
import { markRefreshAuthRejected, resetRefreshAuthRejected, takeRefreshAuthRejected } from '@/features/auth/session-refresh-state';
import { clearRegisteredPushTokenCache } from '@/features/push/push-token-cache';
import { ApiError } from '@/shared/api/api-error';
import { apiFetchJson, type ApiFetchInit } from '@/shared/api/client';
import { fetchIsOffline } from '@/shared/network/connectivity';

const REFRESH_TOKEN_KEY = 'srs.refreshToken.v1';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

let memoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return memoryAccessToken;
}

export async function setSessionTokens(tokens: AuthTokens): Promise<void> {
  memoryAccessToken = tokens.accessToken;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function clearSession(): Promise<void> {
  memoryAccessToken = null;
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // ключ мог отсутствовать (первый запуск / web)
  }
}

async function readRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

let rotatePromise: Promise<boolean> | null = null;

export async function rotateRefreshToken(): Promise<boolean> {
  // Если ротация уже идёт — ждём её, не запускаем новую
  if (rotatePromise) return rotatePromise;

  rotatePromise = (async () => {
    resetRefreshAuthRejected();
    const refreshToken = await readRefreshToken();
    if (!refreshToken) return false;
    if (await fetchIsOffline()) return false;
    const refreshInit: ApiFetchInit = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      skipOfflineMutationGuard: true,
    };
    try {
      const next = await apiFetchJson<AuthTokens>('/auth/refresh', refreshInit);
      await setSessionTokens(next);
      return true;
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        if (e.kind === 'NO_INTERNET' || e.kind === 'TIMEOUT') return false;
        if (e.status === 401) {
          markRefreshAuthRejected();
          await clearSession();
          return false;
        }
        return false;
      }
      return false;
    }
  })();

  try {
    return await rotatePromise;
  } finally {
    rotatePromise = null;
  }
}

export async function ensureSessionReady(): Promise<boolean> {
  if (memoryAccessToken) return true;
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return false;
  if (await fetchIsOffline()) return true;
  const ok = await rotateRefreshToken();
  if (ok) return true;
  if (takeRefreshAuthRejected()) return false;
  return true;
}

/**
 * Отзывает refresh-сессию на сервере (если возможно) и очищает локальные токены.
 */
export async function logoutAndClearSession(): Promise<void> {
  const refreshToken = await readRefreshToken();
  if (refreshToken && !(await fetchIsOffline())) {
    try {
      await apiFetchJson('/auth/logout', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // сеть / 401 — всё равно выходим локально
    }
  }
  await clearSession();
  await clearRegisteredPushTokenCache();
  await clearOfflineAppSnapshots();
}
