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

  it('maps PHYSICAL_GOOD to products tab', () => {
    const nav = resolveContentCtaNavigation(
      baseCta({ target: ContentCtaTarget.PhysicalGood, targetPhysicalGoodId: 'good-1' }),
    );
    expect(nav).toEqual({
      kind: 'expo-router',
      pathname: '/(app)/(tabs)/products',
      params: { highlightPhysicalGoodId: 'good-1' },
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

  it('maps EXTERNAL_URL', () => {
    const nav = resolveContentCtaNavigation(
      baseCta({ target: ContentCtaTarget.ExternalUrl, targetExternalUrl: 'https://example.com' }),
    );
    expect(nav).toEqual({ kind: 'external', url: 'https://example.com' });
  });
});
