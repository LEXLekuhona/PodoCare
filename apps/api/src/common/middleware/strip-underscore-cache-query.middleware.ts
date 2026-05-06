import type { NextFunction, Request, Response } from 'express';

/**
 * OkHttp / React Native иногда добавляют cache-buster `?_=` к URL.
 * Если параметр попадает в объект query, Nest ValidationPipe с `forbidNonWhitelisted`
 * отвечает 400 «property _ should not exist».
 *
 * Чистим сырой `req.url` до парсинга query (удаление только `req.query._` ненадёжно).
 */
export function stripUnderscoreCacheQueryParam(req: Request, _res: Response, next: NextFunction): void {
  const raw = req.url;
  if (raw == null || !raw.includes('?')) {
    next();
    return;
  }
  const qMark = raw.indexOf('?');
  const pathPart = raw.slice(0, qMark);
  const qs = raw.slice(qMark + 1);
  try {
    const sp = new URLSearchParams(qs);
    if (!sp.has('_')) {
      next();
      return;
    }
    sp.delete('_');
    const nextQs = sp.toString();
    req.url = nextQs ? `${pathPart}?${nextQs}` : pathPart;
  } catch {
    /* оставляем как есть */
  }
  next();
}
