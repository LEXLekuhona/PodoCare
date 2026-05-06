import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type EducationAudience = 'client' | 'master';

export type MyCourseDto = {
  id: string;
  title: string;
  coverUrl: string | null;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
};

export type FreeMaterialKind = 'video' | 'article' | 'pdf';

export type FreeMaterialDto = {
  id: string;
  title: string;
  coverUrl: string | null;
  kind: FreeMaterialKind;
  metaLabel: string;
};

export type FeaturedDto = {
  id: string;
  format: 'webinar' | 'intensive';
  title: string;
  description: string;
  coverUrl: string | null;
  priceRub: number;
  metaLeft: string;
  metaRight: string;
  cta: 'register' | 'details';
};

export type EducationScreenDto = {
  myCourses: MyCourseDto[];
  freeMaterials: FreeMaterialDto[];
  featured: FeaturedDto[];
};

export type ContentFeedCtaDto = {
  id: string;
  target: string;
  label: string;
  subtitle: string | null;
  targetExternalUrl?: string | null;
};

export type ContentFeedItemDto = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  format: string;
  audience: string;
  paywall: {
    mode: 'FREE' | 'PAID' | 'PLAN';
    isLocked: boolean;
    priceMinor: number;
    currency: string;
  };
  progress: {
    percent: number;
    completedAt: string | null;
  };
  ctas: ContentFeedCtaDto[];
};

export type ContentFeedDto = {
  items: ContentFeedItemDto[];
};

export async function fetchEducationScreen(audience: EducationAudience): Promise<EducationScreenDto> {
  const q = audience === 'master' ? '?audience=master' : '?audience=client';
  return apiFetchJsonAuth<EducationScreenDto>(`/education/screen${q}`);
}

export async function fetchClientContentFeed(): Promise<ContentFeedDto> {
  return apiFetchJsonAuth<ContentFeedDto>('/client/content/feed');
}

export async function saveContentItemProgress(
  itemId: string,
  payload: { percent: number; lastPositionSeconds?: number },
): Promise<void> {
  await apiFetchJsonAuth(`/client/content/items/${encodeURIComponent(itemId)}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function clickContentItemCta(itemId: string, ctaId: string): Promise<void> {
  await apiFetchJsonAuth(
    `/client/content/items/${encodeURIComponent(itemId)}/cta/${encodeURIComponent(ctaId)}/click`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
}
