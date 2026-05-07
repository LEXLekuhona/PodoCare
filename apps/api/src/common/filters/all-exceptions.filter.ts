import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import type { Request, Response } from 'express';

/**
 * Глобальный обработчик ошибок. Приводит любой вылетевший наружу throw
 * к единому JSON-формату, совпадающему с ApiErrorResponse в shared-types.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = this.buildPayload(exception, isHttp, status, request);

    if (status >= 500) {
      this.logger.error(
        {
          err: exception,
          path: request.url,
          method: request.method,
          requestId: request.id,
        },
        `Unhandled exception on ${request.method} ${request.url}`,
      );
    }

    response.status(status).json(payload);
  }

  private buildPayload(
    exception: unknown,
    isHttp: boolean,
    status: number,
    request: Request & { id?: string },
  ): Record<string, unknown> {
    const base = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.id,
    };

    if (isHttp) {
      const response = (exception as HttpException).getResponse();
      if (typeof response === 'string') {
        return {
          ...base,
          error: (exception as HttpException).name,
          message: response,
        };
      }
      if (typeof response === 'object' && response !== null) {
        return { ...base, ...(response as Record<string, unknown>) };
      }
    }

    return {
      ...base,
      error: 'InternalServerError',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : (exception as Error)?.message ?? String(exception),
    };
  }
}
