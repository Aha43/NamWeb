import { describe, expect, it } from 'vitest';
import { canonicalTag, demoteSystemTag, isSystemTag, isUnknownSystemTag } from './systemTags';

describe('systemTags (#837/#842)', () => {
  it('canonicalTag: legacy alias, sigil case-folding, trimmed user tags', () => {
    expect(canonicalTag('in progress')).toBe('#in-progress'); // legacy read-alias
    expect(canonicalTag('In Progress')).toBe('#in-progress');
    expect(canonicalTag('#Shared-Hide')).toBe('#shared-hide'); // sigil case-folds
    expect(canonicalTag('  groceries  ')).toBe('groceries'); // #842/F3: user tags trimmed
    expect(canonicalTag('#foo')).toBe('#foo'); // unknown sigil tag: canonical but not registered
  });

  it('isSystemTag is REGISTRY-based (#842/F1): only known #… tags, incl. the legacy spelling', () => {
    expect(isSystemTag('#in-progress')).toBe(true);
    expect(isSystemTag('in progress')).toBe(true); // legacy still recognized
    expect(isSystemTag('#shared-hide')).toBe(true);
    expect(isSystemTag('#shared-show')).toBe(true);
    expect(isSystemTag('#shared-open')).toBe(true);
    // An unregistered #… tag a user's doc predates the reservation with is NOT system — it must
    // render/behave as an ordinary tag, not masquerade (bold/protected) then get destroyed.
    expect(isSystemTag('#foo')).toBe(false);
    expect(isSystemTag('groceries')).toBe(false);
    expect(isSystemTag('@phone')).toBe(false);
  });

  it('isUnknownSystemTag / demoteSystemTag: the reserved namespace, non-destructive', () => {
    expect(isUnknownSystemTag('#foo')).toBe(true);
    expect(isUnknownSystemTag('#shared-hide')).toBe(false); // known
    expect(isUnknownSystemTag('foo')).toBe(false); // not in the namespace
    expect(demoteSystemTag('#Foo')).toBe('foo'); // strip sigil, lowercased
    expect(demoteSystemTag('##bar')).toBe('bar');
  });
});
