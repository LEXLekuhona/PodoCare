import { getApiBaseUrl } from '@/shared/config/env';

import { ApiError } from '@/shared/api/api-error';

export { ApiError } from '@/shared/api/api-error';

const NETWORK_ERROR_RU =
  'Нет связи с сервером. В корне проекта выполните: pnpm dev:stack:infra или pnpm dev:android.';

/** OkHttp иногда добавляет `?_=` на стороне нативного стека; если параметр попадает в URL из JS — убираем. */
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

export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
  const normalizedPath = stripUnderscoreCacheParam(path.startsWith('/') ? path : `/${path}`);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${normalizedPath}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        ...(init?.headers ?? {}),
      },
    });
  } catch (e: unknown) {
    if (isLikelyNetworkFailure(e)) {
      throw new ApiError(NETWORK_ERROR_RU, 0);
    }
    throw new ApiError('Не удалось выполнить запрос', 0);
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const trimmed = text.trim();
    /** NestJS при `return null` часто шлёт 200 без тела — не JSON.parse('null'). */
    if (!trimmed) return null as T;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      throw new ApiError('Некорректный ответ сервера', res.status);
    }
  }

  let payload: unknown = undefined;
  try {
    payload = (await res.json()) as unknown;
  } catch {
    // ignore
  }

  const message =
    typeof payload === 'object' && payload && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : `Request failed with status ${res.status}`;

  throw new ApiError(message, res.status, payload);
}

