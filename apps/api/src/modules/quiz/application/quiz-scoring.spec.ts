import { scoreQuizSession } from './quiz-scoring';

describe('quiz-scoring', () => {
  it('sums option weights and tag scores', () => {
    const result = scoreQuizSession(
      [
        { questionId: 'q1', optionIds: ['o1'] },
        { questionId: 'q2', optionIds: ['o3'] },
      ],
      [
        { id: 'o1', questionId: 'q1', weight: 2, tags: ['pain'] },
        { id: 'o2', questionId: 'q1', weight: 0, tags: ['sleep'] },
        { id: 'o3', questionId: 'q2', weight: 3, tags: ['pain', 'stress'] },
      ],
      [{ id: 'r1', segment: 'HIGH', minScore: 5, sortOrder: 0 }],
    );

    expect(result.totalScore).toBe(5);
    expect(result.tagScores).toEqual({ pain: 5, stress: 3 });
    expect(result.segment).toBe('HIGH');
    expect(result.matchedOutcomeId).toBe('r1');
  });

  it('matches outcome by required/excluded tags', () => {
    const result = scoreQuizSession(
      [{ questionId: 'q1', optionIds: ['o1'] }],
      [{ id: 'o1', questionId: 'q1', weight: 1, tags: ['skin'] }],
      [
        {
          id: 'r1',
          segment: 'CRITICAL',
          minScore: 1,
          tagsRequired: ['pain'],
          sortOrder: 0,
        },
        {
          id: 'r2',
          segment: 'LOW',
          minScore: 0,
          tagsExcluded: ['pain'],
          sortOrder: 1,
        },
      ],
    );

    expect(result.segment).toBe('LOW');
    expect(result.matchedOutcomeId).toBe('r2');
  });
});
