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

/** The registry of MEANINGFUL system tags — drives suggestions and the enforcement allowlist.
 *  Membership is otherwise structural (any `#…` tag is system); this list is which ones the app
 *  knows about and lets users apply. */
export const SYSTEM_TAGS: readonly string[] = [IN_PROGRESS_TAG, SHARED_HIDE_TAG];

/** The canonical form of a tag: the legacy `in progress` maps to `#in-progress`; any `#…` tag is
 *  lowercased to its canonical sigil form (NamDesktop may write case variants); a user tag is
 *  returned unchanged. Self-contained (no isSystemTag call) so the two can't recurse. */
export function canonicalTag(tag: string): string {
  const t = tag.trim().toLowerCase();
  if (t === LEGACY_IN_PROGRESS) return IN_PROGRESS_TAG;
  if (t.startsWith(SYSTEM_SIGIL)) return t;
  return tag;
}

/** A system tag is anything whose canonical form sits in the `#` namespace (incl. legacy
 *  `in progress`). Users can't create these — normalizeTags drops unknown `#…` tags. */
export function isSystemTag(tag: string): boolean {
  return canonicalTag(tag).startsWith(SYSTEM_SIGIL);
}

/** A `#…` tag the app doesn't know — an invented system tag a user must not be allowed to keep. */
export function isUnknownSystemTag(tag: string): boolean {
  const c = canonicalTag(tag);
  return c.startsWith(SYSTEM_SIGIL) && !SYSTEM_TAGS.includes(c);
}
