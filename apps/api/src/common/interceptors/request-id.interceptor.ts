import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { ulid } from 'ulid';

import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

/**
 * Проставляет заголовок X-Request-Id входящему запросу и ответу.
 * Если клиент прислал свой request-id — используем его, иначе генерируем ULID.
 * Идентификатор доступен в логах (см. pino customProps) и в теле ошибки.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { id?: string }>();
    const res = context.switchToHttp().getResponse<Response>();

    const incoming = req.headers['x-request-id'];
    const id =
      (Array.isArray(incoming) ? incoming[0] : incoming) ?? ulid().toLowerCase();

    req.id = id;
    res.setHeader('X-Request-Id', id);

    return next.handle();
  }
}
