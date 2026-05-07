import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type ReviewRatings = {
  overall?: number;
  specialist?: number;
  studio?: number;
  service?: number;
};

export type ReviewDto = {
  id: string;
  userId: string;
  studioId: string;
  appointmentId: string | null;
  ratings: ReviewRatings | null;
  comment: string | null;
  allowPublish: boolean;
  createdAt: string;
};

export type CreateReviewPayload = {
  studioId?: string;
  appointmentId?: string;
  comment?: string;
  ratings?: ReviewRatings;
  allowPublish?: boolean;
};

export function submitReview(payload: CreateReviewPayload): Promise<ReviewDto> {
  return apiFetchJsonAuth<ReviewDto>('/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchMyReviews(): Promise<ReviewDto[]> {
  return apiFetchJsonAuth<ReviewDto[]>('/reviews/me');
}
