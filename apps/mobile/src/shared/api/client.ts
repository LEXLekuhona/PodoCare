import { getApiBaseUrl } from '@/shared/config/env';

import { ApiError } from '@/shared/api/api-error';

export { ApiError } from '@/shared/api/api-error';

const NETWORK_ERROR_RU =
  'Нет связи с сервером. В корне проекта выполните: pnpm dev:stack:infra или pnpm dev:android.';

const DEFAULT_TIMEOUT_MS = 25_000;

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

export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
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
      throw new ApiError('Время ожидания ответа истекло. Проверьте интернет и попробуйте ещё раз.', 0);
    }
    if (isLikelyNetworkFailure(e)) {
      throw new ApiError(NETWORK_ERROR_RU, 0);
    }
    throw new ApiError('Не удалось выполнить запрос', 0);
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) {
      throw new ApiError('Сервер вернул пустой ответ', res.status);
    }
    if (!isJsonResponse(res)) {
      throw new ApiError('Сервер вернул неожиданный формат ответа', res.status);
    }
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      throw new ApiError('Некорректный ответ сервера', res.status);
    }
  }

  const rawText = await res.text().catch(() => '');

  let payload: unknown = undefined;
  try {
    payload = rawText ? (JSON.parse(rawText) as unknown) : undefined;
  } catch {
    // ignore
  }

  const fallback = rawText?.trim() ? rawText.trim() : `Request failed with status ${res.status}`;
  const message = messageFromErrorPayload(payload, fallback);

  throw new ApiError(message, res.status, payload);
}

