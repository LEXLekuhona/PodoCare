import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type MeDiagnosticQuiz = {
  quizId: string;
  completedAt: string;
  resultLevel: string;
  score: number;
  outcomeId: string | null;
  outcomeTitle: string | null;
  tagScores: Record<string, number> | null;
};

export type MeProfile = {
  id: string;
  role: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  avatarUrl: string | null;
  /** С сервера всегда приходит для клиента; в старых офлайн-снимках может отсутствовать. */
  diagnosticQuiz?: MeDiagnosticQuiz | null;
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
  /** https URL; пустая строка — убрать аватар. Загрузка файла — `uploadMyAvatar`. */
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

/** Multipart POST: сохраняет файл на сервере и возвращает профиль с https URL аватара. */
export async function uploadMyAvatar(part: { uri: string; name: string; type: string }): Promise<MeProfile> {
  const body = new FormData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RN FormData принимает { uri, name, type }.
  body.append('file', part as any);
  return apiFetchJsonAuth<MeProfile>('/me/avatar', {
    method: 'POST',
    body,
  });
}
