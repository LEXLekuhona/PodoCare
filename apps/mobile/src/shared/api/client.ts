import { getApiBaseUrl } from '@/shared/config/env';

import { ApiError } from '@/shared/api/api-error';
import {
  DEV_NETWORK_HINT,
  USER_MUTATION_OFFLINE,
  USER_OFFLINE_READ_FAILED,
  USER_REQUEST_TIMEOUT,
  USER_SERVER_NO_CACHED_DATA,
} from '@/shared/api/user-facing-errors';
import { fetchIsOffline } from '@/shared/network/connectivity';

export { ApiError } from '@/shared/api/api-error';

function isDevBundle(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export type ApiFetchInit = RequestInit & {
  /** Не блокировать мутации при офлайне (например локальный выход без сети — не используется для обхода бизнес-операций). */
  skipOfflineMutationGuard?: boolean;
};

const DEFAULT_TIMEOUT_MS = 25_000;

function stripUnderscoreCacheParam(relPath: string): string {
  const i = relPath.indexOf('?');
  if (i === -1) return relPath;
  const pathPart = relPath.slice(0, i);
  const qs = relPath.slice(i + 1);
  try {
    const sp = new URLSearchParams(qs);
    sp.delete('_');
    const next = sp.toString();
    return next ? `${pathPart}?${next}` : pathPart;
  } catch {
    return relPath;
  }
}

function isLikelyNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    return (
      m.includes('network request failed') ||
      m.includes('failed to fetch') ||
      m.includes('load failed') ||
      m.includes('networkerror')
    );
  }
  return false;
}

async function fetchWithTimeout(url: string, init: RequestInit | undefined): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = (init as { timeoutMs?: number } | undefined)?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(init ?? {}), signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type')?.toLowerCase() ?? '';
  return ct.includes('application/json') || ct.includes('+json');
}

function messageFromErrorPayload(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const msg = (payload as { message?: unknown }).message;
  if (Array.isArray(msg)) return msg.map(String).join('; ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
}

function methodRequiresServerWrite(init?: ApiFetchInit): boolean {
  const m = (init?.method ?? 'GET').toUpperCase();
  return m !== 'GET' && m !== 'HEAD';
}

export async function apiFetchJson<T>(path: string, init?: ApiFetchInit): Promise<T> {
  if (methodRequiresServerWrite(init) && !init?.skipOfflineMutationGuard) {
    if (await fetchIsOffline()) {
      throw new ApiError(USER_MUTATION_OFFLINE, 0, undefined, 'NO_INTERNET');
    }
  }

  const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
  const normalizedPath = stripUnderscoreCacheParam(path.startsWith('/') ? path : `/${path}`);

  let res: Response;
  try {
    res = await fetchWithTimeout(`${baseUrl}${normalizedPath}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        ...(init?.headers ?? {}),
      },
    } as RequestInit);
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      const msg = isDevBundle() ? `${USER_REQUEST_TIMEOUT} ${DEV_NETWORK_HINT}` : USER_REQUEST_TIMEOUT;
      throw new ApiError(msg, 0, undefined, 'TIMEOUT');
    }
    if (isLikelyNetworkFailure(e)) {
      if (await fetchIsOffline()) {
        const base = methodRequiresServerWrite(init) ? USER_MUTATION_OFFLINE : USER_OFFLINE_READ_FAILED;
        const msg = isDevBundle() ? `${base} ${DEV_NETWORK_HINT}` : base;
        throw new ApiError(msg, 0, undefined, 'NO_INTERNET');
      }
      const msg = isDevBundle() ? `${USER_SERVER_NO_CACHED_DATA} ${DEV_NETWORK_HINT}` : USER_SERVER_NO_CACHED_DATA;
      throw new ApiError(msg, 0, undefined, 'SERVER_UNAVAILABLE');
    }
    throw new ApiError('Не удалось выполнить запрос', 0, undefined, 'SERVER_UNAVAILABLE');
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) {
      throw new ApiError('Сервер вернул пустой ответ', res.status, undefined, 'SERVER_UNAVAILABLE');
    }
    if (!isJsonResponse(res)) {
      throw new ApiError('Сервер вернул неожиданный формат ответа', res.status, undefined, 'SERVER_UNAVAILABLE');
    }
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      throw new ApiError('Некорректный ответ сервера', res.status, undefined, 'SERVER_UNAVAILABLE');
    }
  }

  const rawText = await res.text().catch(() => '');

  let payload: unknown = undefined;
  try {
    payload = rawText ? (JSON.parse(rawText) as unknown) : undefined;
  } catch {
    // ignore
  }

  if (res.status >= 500) {
    throw new ApiError(
      isDevBundle() ? `${USER_SERVER_NO_CACHED_DATA} ${DEV_NETWORK_HINT}` : USER_SERVER_NO_CACHED_DATA,
      res.status,
      payload,
      'SERVER_UNAVAILABLE',
    );
  }

  const fallback = rawText?.trim() ? rawText.trim() : `Request failed with status ${res.status}`;
  const message = messageFromErrorPayload(payload, fallback);

  throw new ApiError(message, res.status, payload);
}
