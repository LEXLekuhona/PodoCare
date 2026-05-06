import * as SecureStore from 'expo-secure-store';

import { clearRegisteredPushTokenCache } from '@/features/push/push-token-cache';
import { apiFetchJson } from '@/shared/api/client';

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
    const refreshToken = await readRefreshToken();
    if (!refreshToken) return false;
    try {
      const next = await apiFetchJson<AuthTokens>('/auth/refresh', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      await setSessionTokens(next);
      return true;
    } catch {
      await clearSession();
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
  return rotateRefreshToken();
}

/**
 * Отзывает refresh-сессию на сервере (если возможно) и очищает локальные токены.
 */
export async function logoutAndClearSession(): Promise<void> {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
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
}
