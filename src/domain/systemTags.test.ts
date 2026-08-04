import { describe, expect, it } from 'vitest';
import { IN_PROGRESS_TAG, NOT_STALLED_TAG, SHARED_HIDE_TAG, SHARED_OPEN_TAG, SHARED_SHOW_TAG, SYSTEM_FEATURES, SYSTEM_TAGS, canonicalTag, featuresFor, isSystemTag } from './systemTags';

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
    expect(isSystemTag('#not-stalled')).toBe(true); // #909
    // An unregistered #… tag a user's doc predates the reservation with is NOT system — it must
    // render/behave as an ordinary tag, not masquerade (bold/protected) then get destroyed.
    expect(isSystemTag('#foo')).toBe(false);
    expect(isSystemTag('groceries')).toBe(false);
    expect(isSystemTag('@phone')).toBe(false);
  });

  it('an unknown #… tag is inert — kept as an ordinary tag, never a system tag (#844)', () => {
    // Semantic reservation: a user's #foo can't collide with / behave as a system tag, but it
    // is NOT rewritten (demoting broke idempotence + cross-store coherence). It stays #foo.
    expect(isSystemTag('#foo')).toBe(false);
    expect(canonicalTag('#foo')).toBe('#foo');
  });

  it('every exported *_TAG constant is registered in SYSTEM_TAGS (drift guard #844)', () => {
    for (const c of [IN_PROGRESS_TAG, SHARED_HIDE_TAG, SHARED_SHOW_TAG, SHARED_OPEN_TAG]) {
      expect(SYSTEM_TAGS).toContain(c); // a constant missing from the registry would silently
      expect(isSystemTag(c)).toBe(true); //  fail: not bold, not protected, treated as user input
    }
  });
});

describe('featuresFor (#1023)', () => {
  const tagsOf = (opts: { isProject: boolean; inShare: boolean }) => featuresFor(opts).map((f) => f.tag);

  it('an action NOT in a share sees only #in-progress', () => {
    expect(tagsOf({ isProject: false, inShare: false })).toEqual([IN_PROGRESS_TAG]);
  });

  it('a project NOT in a share sees only #not-stalled', () => {
    expect(tagsOf({ isProject: true, inShare: false })).toEqual([NOT_STALLED_TAG]);
  });

  it('inside a share, an action gains the both-scoped #shared-* rows but not the project-only ones', () => {
    const tags = tagsOf({ isProject: false, inShare: true });
    expect(tags).toContain(IN_PROGRESS_TAG);
    expect(tags).toContain(SHARED_HIDE_TAG);
    expect(tags).toContain(SHARED_SHOW_TAG);
    expect(tags).not.toContain(SHARED_OPEN_TAG); // project-scoped
    expect(tags).not.toContain(NOT_STALLED_TAG); // project-scoped
  });

  it('inside a share, a project gains #shared-open plus the both-scoped rows', () => {
    const tags = tagsOf({ isProject: true, inShare: true });
    expect(tags).toEqual([NOT_STALLED_TAG, SHARED_HIDE_TAG, SHARED_SHOW_TAG, SHARED_OPEN_TAG]);
    expect(tags).not.toContain(IN_PROGRESS_TAG); // action-scoped
  });

  it('every feature maps to a registered system tag (drift guard)', () => {
    for (const f of SYSTEM_FEATURES) expect(SYSTEM_TAGS).toContain(f.tag);
  });
});
