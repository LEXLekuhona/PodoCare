import { describe, expect, it } from '@jest/globals';
import { ContentCtaTarget } from '@srs/shared-types';
import type { ClientContentFeedCta } from '@srs/shared-types';

import { resolveContentCtaNavigation } from './content-cta-routing';

function baseCta(partial: Partial<ClientContentFeedCta> & Pick<ClientContentFeedCta, 'target'>): ClientContentFeedCta {
  return {
    id: 'cta-1',
    label: 'X',
    subtitle: null,
    sortOrder: 0,
    targetProgramId: null,
    targetSeriesId: null,
    targetServiceId: null,
    targetPhysicalGoodId: null,
    targetQuizId: null,
    targetExternalUrl: null,
    ...partial,
  };
}

describe('resolveContentCtaNavigation', () => {
  it('maps SERVICE to specialists flow with serviceId', () => {
    const nav = resolveContentCtaNavigation(
      baseCta({ target: ContentCtaTarget.Service, targetServiceId: 'srv-1' }),
    );
    expect(nav).toEqual({
      kind: 'expo-router',
      pathname: '/(app)/specialists',
      params: { serviceId: 'srv-1' },
    });
  });

  it('maps PHYSICAL_GOOD to product screen', () => {
    const nav = resolveContentCtaNavigation(
      baseCta({ target: ContentCtaTarget.PhysicalGood, targetPhysicalGoodId: 'good-1' }),
    );
    expect(nav).toEqual({
      kind: 'expo-router',
      pathname: '/(app)/product/[id]',
      params: { id: 'good-1' },
    });
  });

  it('maps QUIZ to in-app quiz route', () => {
    const nav = resolveContentCtaNavigation(
      baseCta({ target: ContentCtaTarget.Quiz, targetQuizId: 'quiz-uuid' }),
    );
    expect(nav).toEqual({
      kind: 'expo-router',
      pathname: '/(app)/quiz',
      params: { quizId: 'quiz-uuid' },
    });
  });

  it('maps PROGRAM to education tab with focusProgramId', () => {
    const nav = resolveContentCtaNavigation(
      baseCta({ target: ContentCtaTarget.Program, targetProgramId: 'prg-1' }),
    );
    expect(nav).toMatchObject({
      kind: 'expo-router',
      pathname: '/(app)/(tabs)/education',
      params: { focusProgramId: 'prg-1' },
    });
  });

  it('maps PROGRAM_INQUIRY to education with programInquiry flag', () => {
    const nav = resolveContentCtaNavigation(
      baseCta({ target: ContentCtaTarget.ProgramInquiry, targetProgramId: 'prg-2' }),
    );
    expect(nav).toEqual({
      kind: 'expo-router',
      pathname: '/(app)/(tabs)/education',
      params: { focusProgramId: 'prg-2', programInquiry: '1' },
    });
  });

  it('maps EXTERNAL_URL', () => {
    const nav = resolveContentCtaNavigation(
      baseCta({ target: ContentCtaTarget.ExternalUrl, targetExternalUrl: 'https://example.com' }),
    );
    expect(nav).toEqual({ kind: 'external', url: 'https://example.com' });
  });
});
