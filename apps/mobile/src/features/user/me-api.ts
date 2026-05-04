import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type MeProfile = {
  id: string;
  role: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  avatarUrl: string | null;
};

export async function getMe(): Promise<MeProfile> {
  return apiFetchJsonAuth<MeProfile>('/me');
}

export async function patchMe(body: {
  firstName?: string;
  lastName?: string;
  email?: string;
  /** ISO `YYYY-MM-DD` или пустая строка для сброса */
  birthDate?: string;
  /** https URL или data URI; пустая строка — убрать аватар */
  avatarUrl?: string;
}): Promise<MeProfile> {
  return apiFetchJsonAuth<MeProfile>('/me', {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
