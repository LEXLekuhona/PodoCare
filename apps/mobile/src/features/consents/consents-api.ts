import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type ClientConsentDto = {
  id: string;
  type: string;
  documentVersion: string;
  signedAt: string;
  title: string;
  status: 'ACTIVE';
};

export async function fetchMyConsents(): Promise<ClientConsentDto[]> {
  return apiFetchJsonAuth<ClientConsentDto[]>('/me/consents');
}

export async function recordConsents(
  items: { type: string; documentVersion: string }[],
): Promise<ClientConsentDto[]> {
  return apiFetchJsonAuth<ClientConsentDto[]>('/me/consents', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items }),
  });
}
