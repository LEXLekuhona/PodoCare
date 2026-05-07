import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type CreateReviewPayload = {
  studioId?: string;
  appointmentId?: string;
  comment?: string;
  ratings?: {
    overall?: number;
    specialist?: number;
    studio?: number;
    service?: number;
  };
  allowPublish?: boolean;
};

export async function createReview(payload: CreateReviewPayload): Promise<void> {
  await apiFetchJsonAuth('/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

