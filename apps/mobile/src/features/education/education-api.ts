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

export async function fetchEducationScreen(audience: EducationAudience): Promise<EducationScreenDto> {
  const q = audience === 'master' ? '?audience=master' : '?audience=client';
  return apiFetchJsonAuth<EducationScreenDto>(`/education/screen${q}`);
}
