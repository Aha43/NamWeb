import { describe, expect, it } from 'vitest';
import { newShareToken, SHARE_TOKEN_LENGTH } from './shareToken';

describe('newShareToken', () => {
  it('produces 22-char base62 tokens, unique across draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = newShareToken();
      expect(t).toMatch(new RegExp(`^[A-Za-z0-9]{${SHARE_TOKEN_LENGTH}}$`));
      seen.add(t);
    }
    expect(seen.size).toBe(200);
  });
});
