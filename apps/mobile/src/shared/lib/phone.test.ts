import { describe, expect, it } from '@jest/globals';

import { digitsToRuE164 } from '@/shared/lib/phone';

describe('digitsToRuE164', () => {
  it('formats 10 digits', () => {
    expect(digitsToRuE164('9991112233')).toBe('+79991112233');
  });

  it('strips non-digits', () => {
    expect(digitsToRuE164('(999) 111-22-33')).toBe('+79991112233');
  });

  it('truncates extra digits', () => {
    expect(digitsToRuE164('799911122331234')).toBe('+79991112233');
  });

  it('throws when short', () => {
    expect(() => digitsToRuE164('999')).toThrow();
  });
});
