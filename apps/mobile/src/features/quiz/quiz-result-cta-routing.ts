import type { ClientContentFeedCta } from '@srs/shared-types';
import { ContentCtaTarget } from '@srs/shared-types';

import { resolveContentCtaNavigation } from '@/features/education/content-cta-routing';

import type { QuizResultDto } from './quiz-api';

function toCtaTarget(raw: string | null | undefined): ContentCtaTarget | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  const all = Object.values(ContentCtaTarget) as string[];
  return all.includes(v) ? (v as ContentCtaTarget) : null;
}

/** Собирает псевдо-CTA из ответа complete квиза для общего резолвера навигации. */
export function quizResultToSyntheticCta(result: QuizResultDto): ClientContentFeedCta | null {
  const rc = result.recommendedCta;
  if (!rc) return null;
  const target = toCtaTarget(rc.target);
  if (!target) return null;
  return {
    id: 'quiz-outcome-cta',
    target,
    label: rc.label?.trim() || 'Далее',
    subtitle: null,
    sortOrder: 0,
    targetProgramId: rc.targetProgramId ?? null,
    targetSeriesId: rc.targetSeriesId ?? null,
    targetServiceId: rc.targetServiceId ?? null,
    targetPhysicalGoodId: rc.targetPhysicalGoodId ?? null,
    targetQuizId: rc.targetQuizId ?? null,
    targetExternalUrl: rc.targetExternalUrl ?? null,
  };
}

export function resolveQuizResultNavigation(result: QuizResultDto) {
  const cta = quizResultToSyntheticCta(result);
  if (!cta) return null;
  return resolveContentCtaNavigation(cta);
}
