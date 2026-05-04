/** Expo Router иногда отдаёт строки вида "undefined"; URLSearchParams с undefined даёт литерал `undefined` в query. */

/**
 * Как `validator.isUUID(..., 'loose')`: 8-4-4-4-12 hex. Совпадает с текстовым UUID в PostgreSQL
 * и с `@IsUUID('loose')` на API — тестовые id вроде `0000…0001` / `bbbb…bbb1` не являются RFC v1–v8, но в БД допустимы.
 */
const UUID_LOOSE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitizeRouteParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  const raw = Array.isArray(v) ? v[0] : v;
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s || s === 'undefined' || s === 'null') return undefined;
  return s;
}

/** Берёт первый непустой параметр (локальный экран имеет приоритет над глобальным URL). */
export function firstRouteParam(...candidates: Array<string | string[] | undefined>): string | undefined {
  for (const c of candidates) {
    const s = sanitizeRouteParam(c);
    if (s != null) return s;
  }
  return undefined;
}

/** UUID из query иногда приходит percent-encoded; дефисы бывают unicode — приводим к ASCII перед `isUuid`. */
export function decodeRouteIdParam(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* некорректные escape — оставляем как есть */
  }
  s = s.replace(/[\u2010\u2011\u2212]/g, '-').trim();
  return s || undefined;
}

export function isUuid(value: string | undefined): boolean {
  return value != null && UUID_LOOSE_RE.test(value);
}
