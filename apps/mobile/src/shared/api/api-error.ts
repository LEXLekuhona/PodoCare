import type { ApiErrorResponse } from '@srs/shared-types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: ApiErrorResponse | unknown,
  ) {
    super(message);
  }
}
