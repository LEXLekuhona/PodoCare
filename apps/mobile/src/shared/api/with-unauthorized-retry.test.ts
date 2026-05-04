import { describe, expect, it } from '@jest/globals';

import { ApiError } from '@/shared/api/api-error';
import { withUnauthorizedRetry } from '@/shared/api/with-unauthorized-retry';

describe('withUnauthorizedRetry', () => {
  it('returns first successful attempt', async () => {
    const result = await withUnauthorizedRetry(
      async () => 42,
      async () => {
        throw new Error('recover should not run');
      },
    );
    expect(result).toBe(42);
  });

  it('retries once after 401 when recover succeeds', async () => {
    let calls = 0;
    const result = await withUnauthorizedRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw new ApiError('unauthorized', 401);
        return 'ok';
      },
      async () => true,
    );
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('does not retry on non-401', async () => {
    await expect(
      withUnauthorizedRetry(
        async () => {
          throw new ApiError('bad', 400);
        },
        async () => true,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('throws original 401 when recover fails', async () => {
    const err = new ApiError('unauthorized', 401);
    await expect(
      withUnauthorizedRetry(
        async () => {
          throw err;
        },
        async () => false,
      ),
    ).rejects.toBe(err);
  });
});
