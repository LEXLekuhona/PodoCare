import type { ClientContentFeedCta } from '@srs/shared-types';
import { ContentCtaTarget } from '@srs/shared-types';

/**
 * Намерение навигации по CTA из ленты контента.
 * Соответствует маршрутам expo-router в apps/mobile/app.
 */
export type ContentCtaNavigationIntent =
  | { kind: 'expo-router'; pathname: string; params?: Record<string, string> }
  | { kind: 'external'; url: string }
  | { kind: 'unhandled'; target: ContentCtaTarget; reason: string };

/**
 * Схема переходов: контент → запись / программа / товар / серия / квиз / внешняя ссылка.
 * Экраны программы и deep-link по товару дорабатываются по мере появления маршрутов;
 * для них возвращается best-effort маршрут с query-параметрами.
 */
export function resolveContentCtaNavigation(cta: ClientContentFeedCta): ContentCtaNavigationIntent {
  switch (cta.target) {
    case ContentCtaTarget.Service:
      if (!cta.targetServiceId) {
        return { kind: 'unhandled', target: cta.target, reason: 'missing_targetServiceId' };
      }
      return {
        kind: 'expo-router',
        pathname: '/(app)/specialists',
        params: { serviceId: cta.targetServiceId },
      };
    case ContentCtaTarget.PhysicalGood:
      if (!cta.targetPhysicalGoodId) {
        return { kind: 'unhandled', target: cta.target, reason: 'missing_targetPhysicalGoodId' };
      }
      return {
        kind: 'expo-router',
        pathname: '/(app)/(tabs)/products',
        params: { highlightPhysicalGoodId: cta.targetPhysicalGoodId },
      };
    case ContentCtaTarget.Program:
    case ContentCtaTarget.ProgramInquiry:
      if (!cta.targetProgramId) {
        return { kind: 'unhandled', target: cta.target, reason: 'missing_targetProgramId' };
      }
      return {
        kind: 'expo-router',
        pathname: '/(app)/(tabs)/education',
        params: { focusProgramId: cta.targetProgramId },
      };
    case ContentCtaTarget.ContentSeries:
      if (!cta.targetSeriesId) {
        return { kind: 'unhandled', target: cta.target, reason: 'missing_targetSeriesId' };
      }
      return {
        kind: 'expo-router',
        pathname: '/(app)/(tabs)/education',
        params: { focusContentSeriesId: cta.targetSeriesId },
      };
    case ContentCtaTarget.Quiz:
      if (!cta.targetQuizId) {
        return { kind: 'unhandled', target: cta.target, reason: 'missing_targetQuizId' };
      }
      return {
        kind: 'expo-router',
        pathname: '/(auth)/quiz',
        params: { contentQuizId: cta.targetQuizId },
      };
    case ContentCtaTarget.ExternalUrl:
      if (!cta.targetExternalUrl) {
        return { kind: 'unhandled', target: cta.target, reason: 'missing_targetExternalUrl' };
      }
      return { kind: 'external', url: cta.targetExternalUrl };
    default: {
      const _exhaustive: never = cta.target;
      return { kind: 'unhandled', target: _exhaustive, reason: 'unknown_target' };
    }
  }
}
