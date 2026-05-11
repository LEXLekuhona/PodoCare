/**
 * Контракты публичного API контента (клиентская лента, прогресс, CTA).
 * Согласованы с ответами ContentService; мобильное приложение и тесты опираются на эти типы.
 */

import type { ContentAudience, ContentCtaTarget, ContentFormat } from './enums';

/** Режим монетизации единицы в ленте (серия может быть платной). */
export type ContentPaywallMode = 'FREE' | 'PAID' | 'PLAN';

/** Статус публикации в телах create/update DTO (админ). */
export type ContentPublicationStatus = 'draft' | 'published';

/** Пейволл и доступ к материалу в ленте клиента. */
export interface ClientContentFeedPaywall {
  mode: ContentPaywallMode;
  isLocked: boolean;
  priceMinor: number;
  currency: string;
}

/** Прогресс клиента по единице контента в ленте и после сохранения. */
export interface ClientContentFeedProgress {
  percent: number;
  completedAt: string | null;
}

/** CTA в ответе ленты: все целевые id опциональны, заполняется ровно одно для не-EXTERNAL. */
export interface ClientContentFeedCta {
  id: string;
  target: ContentCtaTarget;
  label: string;
  subtitle: string | null;
  sortOrder: number;
  targetProgramId: string | null;
  targetSeriesId: string | null;
  targetServiceId: string | null;
  targetPhysicalGoodId: string | null;
  targetQuizId: string | null;
  targetExternalUrl: string | null;
}

/** Элемент ленты контента (GET /client/content/feed). */
export interface ClientContentFeedItem {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  format: ContentFormat;
  seriesId: string;
  audience: ContentAudience;
  paywall: ClientContentFeedPaywall;
  progress: ClientContentFeedProgress;
  ctas: ClientContentFeedCta[];
}

export interface ClientContentFeedResponse {
  items: ClientContentFeedItem[];
}

/**
 * Ответ GET /client/content/items/:id — детальный материал для экрана чтения.
 * Расширяет ленту полем `body` (JSON по формату) и метаданными для оффлайн/seekbar.
 *
 * Поле `body` сознательно типизировано как `unknown` на уровне контракта: его форма зависит
 * от {@link ContentFormat} (см. validateContentItemBody на бэкенде). Клиент должен сам
 * сужать тип после проверки формата, чтобы не терять валидацию хранения.
 */
export interface ClientContentItemDetail extends ClientContentFeedItem {
  body: unknown;
  durationSeconds: number | null;
  isFreePreview: boolean;
  seriesTitle: string;
}

/** Ответ POST /client/content/items/:id/progress */
export interface ClientContentProgressSaved {
  itemId: string;
  percent: number;
  completedAt: string | null;
  lastPositionSeconds: number | null;
}

/** Ответ POST /client/content/items/:id/cta/:ctaId/click */
export interface ClientContentCtaClickResponse {
  ok: true;
  ctaId: string;
  target: ContentCtaTarget;
  targetProgramId: string | null;
  targetSeriesId: string | null;
  targetServiceId: string | null;
  targetPhysicalGoodId: string | null;
  targetQuizId: string | null;
  targetExternalUrl: string | null;
}
