import type { ApiErrorResponse } from '@srs/shared-types';

/** Классификация для UI (офлайн, сервер, таймаут). */
export type ApiErrorKind = 'NO_INTERNET' | 'SERVER_UNAVAILABLE' | 'TIMEOUT' | 'AUTH';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: ApiErrorResponse | unknown,
    public readonly kind?: ApiErrorKind,
  ) {
    super(message);
  }
}
