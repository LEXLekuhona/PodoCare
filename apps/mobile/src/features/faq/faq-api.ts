import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type FaqItemDto = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
};

export function fetchFaqItems(): Promise<FaqItemDto[]> {
  return apiFetchJsonAuth<FaqItemDto[]>('/faq');
}
