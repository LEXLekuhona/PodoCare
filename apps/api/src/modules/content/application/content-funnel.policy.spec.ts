import {
  buildPublishState,
  isAudienceVisibleForClient,
  resolvePaywallMode,
} from './content-funnel.policy';

describe('content-funnel policy', () => {
  it('resolves paywall mode from price', () => {
    expect(resolvePaywallMode(0)).toBe('FREE');
    expect(resolvePaywallMode(1)).toBe('PAID');
  });

  it('builds publish state for draft and published', () => {
    const draft = buildPublishState('draft', new Date('2026-01-01T00:00:00.000Z'));
    expect(draft).toEqual({ isPublished: false, publishedAt: null });

    const existingPublishedAt = new Date('2026-02-01T00:00:00.000Z');
    const published = buildPublishState('published', existingPublishedAt);
    expect(published.isPublished).toBe(true);
    expect(published.publishedAt).toBe(existingPublishedAt);
  });

  it('validates audience for client visibility', () => {
    expect(isAudienceVisibleForClient('CLIENT')).toBe(true);
    expect(isAudienceVisibleForClient('EVERYONE')).toBe(true);
    expect(isAudienceVisibleForClient('SPECIALIST')).toBe(false);
  });
});
