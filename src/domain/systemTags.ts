// Built-in "system" tags (#651, namespaced under `#` in #837): stored as ordinary tags in the
// shared workspace document, but the web treats the `#` prefix as a RESERVED namespace — system
// tags render bold, resist rename/delete, are always offered in suggestions, and users cannot
// mint new ones (normalizeTags drops any `#…` not in the registry below). Three tag lanes:
// `@…` = context (a user convention, unenforced, untouched), `#…` = system (reserved), else a
// plain user tag.
//
// Format note: system tags historically had no sigil ("in progress", "private"). The web now
// writes the sigiled forms; `canonicalTag` read-aliases the one legacy spelling still churned on
// live documents ("in progress" → "#in-progress"). `private` was renamed to `#shared-hide` with
// NO alias (it's freed for future generic use — safe because no live node carried it at the cut).
// A NamDesktop revival must adopt the `#` sigil.

export const SYSTEM_SIGIL = '#';

/** The one pre-sigil spelling still read-aliased (auto-managed on live items; no security stakes,
 *  converges to the sigiled form as items are touched). `private` is deliberately NOT aliased. */
const LEGACY_IN_PROGRESS = 'in progress';

/** Marks the action you're actively working on — orthogonal to status (a Backlog item you've
 *  started but are waiting on is legitimately both). */
export const IN_PROGRESS_TAG = '#in-progress';

/** Keeps a node (and its whole subtree) OUT of a published project share (#759) — the opt-out
 *  half of the sharing visibility grammar. Renamed from the pre-sigil `private` (#837). */
export const SHARED_HIDE_TAG = '#shared-hide';

/** Forces a node back IN on a share even when a per-share TOGGLE (e.g. Hide completed) would
 *  drop it (#838). Never beats a hard exclusion (#shared-hide/cancelled/archived). */
export const SHARED_SHOW_TAG = '#shared-show';

/** A section that renders EXPANDED on arrival, overriding the collapsed-by-default (#838). */
export const SHARED_OPEN_TAG = '#shared-open';

/** The registry of MEANINGFUL system tags — drives suggestions and the enforcement allowlist.
 *  Membership is otherwise structural (any `#…` tag is system); this list is which ones the app
 *  knows about and lets users apply. */
export const SYSTEM_TAGS: readonly string[] = [IN_PROGRESS_TAG, SHARED_HIDE_TAG, SHARED_SHOW_TAG, SHARED_OPEN_TAG];

/** The canonical form of a tag: the legacy `in progress` maps to `#in-progress`; any `#…` tag is
 *  lowercased to its canonical sigil form (NamDesktop may write case variants); a user tag is
 *  returned unchanged. Self-contained (no isSystemTag call) so the two can't recurse. */
export function canonicalTag(tag: string): string {
  const t = tag.trim().toLowerCase();
  if (t === LEGACY_IN_PROGRESS) return IN_PROGRESS_TAG;
  if (t.startsWith(SYSTEM_SIGIL)) return t;
  return tag.trim(); // #842/F3: trim user tags too, so a NamDesktop-padded " foo" matches "foo"
}

/** A system tag is a KNOWN one (canonical form in the registry, incl. legacy `in progress`)
 *  — registry-based, not "any `#…`" (#842/F1): an unregistered `#foo` a user's doc predates the
 *  reservation with must render/behave as an ORDINARY tag, not masquerade as system. */
export function isSystemTag(tag: string): boolean {
  return SYSTEM_TAGS.includes(canonicalTag(tag));
}

/** A `#…` tag the app doesn't know — the reserved namespace a user may not keep. normalizeTags
 *  DEMOTES these (strips the sigil) rather than destroying them (#842/F1). */
export function isUnknownSystemTag(tag: string): boolean {
  const c = canonicalTag(tag);
  return c.startsWith(SYSTEM_SIGIL) && !SYSTEM_TAGS.includes(c);
}

/** Strip the reserved sigil from an unknown `#…` tag, demoting it to a plain user tag. */
export function demoteSystemTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/^#+/, '');
}
