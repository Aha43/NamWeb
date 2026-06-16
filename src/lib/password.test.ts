import { describe, expect, it } from 'vitest';
import { validateNewPassword } from './password';

describe('validateNewPassword', () => {
  it('rejects too-short passwords', () => {
    expect(validateNewPassword('short', 'short')).toMatch(/at least 8/i);
  });

  it('rejects a mismatch', () => {
    expect(validateNewPassword('longenough', 'different1')).toMatch(/don't match/i);
  });

  it('accepts a valid, matching password', () => {
    expect(validateNewPassword('longenough', 'longenough')).toBeNull();
  });
});
