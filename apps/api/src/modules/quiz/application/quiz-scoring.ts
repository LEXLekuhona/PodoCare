export type QuizAnswerInput = {
  questionId: string;
  optionIds: string[];
};

export type QuizOptionForScoring = {
  id: string;
  questionId: string;
  weight: number;
  tags: string[];
};

export type QuizOutcomeRule = {
  id: string;
  segment: string;
  minScore?: number;
  maxScore?: number;
  tagsRequired?: string[];
  tagsExcluded?: string[];
  sortOrder: number;
};

export type QuizScoreResult = {
  totalScore: number;
  tagScores: Record<string, number>;
  matchedOutcomeId: string | null;
  segment: string;
};

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function scoreQuizSession(
  answers: QuizAnswerInput[],
  options: QuizOptionForScoring[],
  outcomes: QuizOutcomeRule[],
): QuizScoreResult {
  const optionById = new Map(options.map((option) => [option.id, option]));
  const tagScores = new Map<string, number>();
  let totalScore = 0;

  for (const answer of answers) {
    for (const optionId of answer.optionIds) {
      const option = optionById.get(optionId);
      if (!option || option.questionId !== answer.questionId) continue;
      totalScore += option.weight;
      for (const rawTag of option.tags) {
        const tag = normalizeTag(rawTag);
        if (tag === '') continue;
        tagScores.set(tag, (tagScores.get(tag) ?? 0) + option.weight);
      }
    }
  }

  const sortedOutcomes = [...outcomes].sort((a, b) => a.sortOrder - b.sortOrder);
  const positiveTags = new Set(
    [...tagScores.entries()].filter(([, score]) => score > 0).map(([tag]) => tag),
  );
  let matchedOutcome: QuizOutcomeRule | null = null;

  for (const outcome of sortedOutcomes) {
    const minOk = outcome.minScore == null || totalScore >= outcome.minScore;
    const maxOk = outcome.maxScore == null || totalScore <= outcome.maxScore;
    if (!minOk || !maxOk) continue;

    const required = (outcome.tagsRequired ?? []).map(normalizeTag).filter(Boolean);
    const excluded = (outcome.tagsExcluded ?? []).map(normalizeTag).filter(Boolean);
    const requiredOk = required.every((tag) => positiveTags.has(tag));
    const excludedOk = excluded.every((tag) => !positiveTags.has(tag));
    if (requiredOk && excludedOk) {
      matchedOutcome = outcome;
      break;
    }
  }

  return {
    totalScore,
    tagScores: Object.fromEntries(tagScores.entries()),
    matchedOutcomeId: matchedOutcome?.id ?? null,
    segment: matchedOutcome?.segment ?? 'MEDIUM',
  };
}
