import { getApiUrl } from './config';
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  saveAuth,
  readStoredUser,
} from '../lib/auth-storage';

import type { StoredAuth, StoredUser, TokenPair } from '../lib/auth-storage';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface StaffLoginResponse {
  user: StoredUser;
  tokens: TokenPair;
}

function nestMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Ошибка запроса';
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) {
    return message.map(String).join('; ');
  }
  if (typeof message === 'string' && message.length > 0) {
    return message;
  }
  return 'Ошибка запроса';
}

export async function staffLogin(email: string, password: string): Promise<StoredAuth> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password,
      deviceType: 'admin_web',
    }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, nestMessage(body), body);
  }
  const parsed = body as StaffLoginResponse;
  const auth: StoredAuth = {
    accessToken: parsed.tokens.accessToken,
    refreshToken: parsed.tokens.refreshToken,
    user: parsed.user,
  };
  saveAuth(auth);
  return auth;
}

let refreshInFlight: Promise<TokenPair | null> | null = null;

async function refreshTokensPair(): Promise<TokenPair | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const rt = getRefreshToken();
    if (!rt) return null;
    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      clearAuth();
      return null;
    }
    const tokens = body as TokenPair;
    const user = readStoredUser();
    if (!user) {
      clearAuth();
      return null;
    }
    saveAuth({ ...tokens, user });
    return tokens;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function logoutRemote(): Promise<void> {
  const rt = getRefreshToken();
  if (!rt) return;
  const apiUrl = getApiUrl();
  try {
    await fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
  } catch {
    /* ignore */
  }
  clearAuth();
}

async function fetchWithAuth(
  input: string,
  init: RequestInit,
  accessToken: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(input, { ...init, headers });
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  let token = getAccessToken();

  if (!token) {
    clearAuth();
    throw new ApiError(401, 'Нет сессии');
  }

  let res: Response;
  try {
    res = await fetchWithAuth(url, init, token);
  } catch {
    throw new ApiError(0, 'Нет связи с сервером');
  }
  if (res.status === 401 && retry) {
    const next = await refreshTokensPair();
    if (!next) {
      window.dispatchEvent(new Event('srs_admin_auth_changed'));
      throw new ApiError(401, 'Сессия истекла');
    }
    token = next.accessToken;
    try {
      res = await fetchWithAuth(url, init, token);
    } catch {
      throw new ApiError(0, 'Нет связи с сервером');
    }
  }

  if (res.status === 204) return undefined as T;

  const ct = res.headers.get('content-type')?.toLowerCase() ?? '';
  const rawText = await res.text().catch(() => '');
  const isJson = ct.includes('application/json') || ct.includes('+json');
  const body: unknown = isJson && rawText.trim() ? (() => {
    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  })() : null;
  if (!res.ok) {
    const msg = rawText.trim() ? rawText.trim() : nestMessage(body);
    throw new ApiError(res.status, msg, body ?? rawText);
  }
  if (!rawText.trim()) return null as T;
  return (body ?? rawText) as T;
}
