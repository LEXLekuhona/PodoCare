import { apiFetchJson } from '@/shared/api/client';
import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type QuizOptionDto = {
  id: string;
  order: number;
  text: string;
};

export type QuizQuestionDto = {
  id: string;
  order: number;
  text: string;
  type: string;
  options: QuizOptionDto[];
};

export type QuizDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  questions: QuizQuestionDto[];
};

export type QuizResultDto = {
  segment: string;
  score: number;
  title: string | null;
  description: string | null;
  recommendedCta:
    | {
        label: string | null;
        target: string | null;
      }
    | null;
  recommendedContent: string[];
};

export async function fetchActiveQuiz(): Promise<QuizDto> {
  return apiFetchJson<QuizDto>('/quiz/active');
}

export async function createQuizSession(input: { quizId: string; anonToken: string }) {
  return apiFetchJson<{ sessionId: string; status: 'ACTIVE' }>(`/quiz/sessions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function submitQuizAnswer(sessionId: string, input: { questionId: string; optionIds: string[] }) {
  return apiFetchJson<{ sessionId: string; status: 'ACTIVE'; answeredCount: number }>(
    `/quiz/sessions/${sessionId}/answers`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
}

export async function completeQuizSession(sessionId: string) {
  return apiFetchJson<{ sessionId: string; status: 'COMPLETED'; result: QuizResultDto }>(
    `/quiz/sessions/${sessionId}/complete`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    },
  );
}

export async function mergeQuizSessionWithUser(sessionId: string): Promise<void> {
  await apiFetchJsonAuth(`/quiz/sessions/${sessionId}/merge-with-user`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });
}
