import type { ContentPaywallMode } from '@srs/shared-types';

export function resolvePaywallMode(priceMinor: number): ContentPaywallMode {
  return priceMinor > 0 ? 'PAID' : 'FREE';
}

export function isAudienceVisibleForClient(audience: string): boolean {
  return audience === 'CLIENT' || audience === 'EVERYONE';
}

export function buildPublishState(
  status: 'draft' | 'published' | undefined,
  publishedAt: Date | null,
): {
  isPublished?: boolean;
  publishedAt?: Date | null;
} {
  if (status === undefined) {
    return {};
  }
  if (status === 'draft') {
    return { isPublished: false, publishedAt: null };
  }
  return { isPublished: true, publishedAt: publishedAt ?? new Date() };
}
