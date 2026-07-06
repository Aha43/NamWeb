import { describe, expect, it } from 'vitest';
import { ACTION_LINK_PREFIX, makeActionLink, parseActionLink } from './actionLinks';

describe('action links (#658)', () => {
  it('round-trips an id through make/parse', () => {
    const link = makeActionLink('abc-123');
    expect(link).toEqual({ type: 'URI', value: `${ACTION_LINK_PREFIX}abc-123`, description: null });
    expect(parseActionLink(link)).toBe('abc-123');
  });

  it('ordinary resources are not links', () => {
    expect(parseActionLink({ type: 'URI', value: 'https://example.com', description: null })).toBeNull();
    expect(parseActionLink({ type: 'TEXT', value: 'nam://action/abc', description: null })).toBeNull();
  });
});
