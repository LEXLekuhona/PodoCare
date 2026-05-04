/**
 * Общие типы, которыми пользуется и API, и клиенты.
 */

/** UUID v4 в каноническом строковом виде. */
export type Uuid = string;

/** ISO 8601 timestamp (UTC), например "2026-04-17T12:34:56.000Z". */
export type IsoDateTime = string;

/** ISO 8601 date, например "2026-04-17". */
export type IsoDate = string;

/** HH:mm (часы и минуты), например "09:30". */
export type TimeString = string;

/** Телефон в формате E.164, например "+79991234567". */
export type PhoneE164 = string;

/**
 * Стандартный конверт ошибок API, совпадает с форматом,
 * который возвращает global exception filter на бэкенде.
 */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  code?: string;
  timestamp: IsoDateTime;
  path: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

/** Стандартная обёртка для пагинированных списков. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

/** Параметры пагинации в query. */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/** Утилита: делает все поля объекта readonly глубоко. */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
