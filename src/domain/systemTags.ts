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

/** On a PROJECT: it intentionally has no next action, so "Loose ends" must not flag it as stalled
 *  (#909) — e.g. a sprint/handover project whose actions are drafts you delete when done. */
export const NOT_STALLED_TAG = '#not-stalled';

/** The registry of MEANINGFUL system tags — drives suggestions and the enforcement allowlist.
 *  Membership is otherwise structural (any `#…` tag is system); this list is which ones the app
 *  knows about and lets users apply. */
export const SYSTEM_TAGS: readonly string[] = [IN_PROGRESS_TAG, SHARED_HIDE_TAG, SHARED_SHOW_TAG, SHARED_OPEN_TAG, NOT_STALLED_TAG];

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

/** Which node kinds a feature makes sense on. `both` = actions and projects. */
export type FeatureAppliesTo = 'action' | 'project' | 'both';

/**
 * A **Feature**: the user-facing face of a system tag (#1023). System tags are *functional* — they
 * flip a behaviour on/off — so users shouldn't have to hunt for a `#`-tag or decode its name. The
 * Features dialog renders one row per applicable feature (checkbox + plain-language description).
 *
 * The registry is the single source of truth the dialog reads. It's deliberately richer than a
 * 1:1 tag↔checkbox map so future behaviours can diverge from "just toggle one tag" — a combo-box
 * row, or a checkbox that sets several tags — by extending this shape, not rewriting the dialog.
 */
export interface SystemFeature {
  /** The system tag this feature currently maps to (the whole effect, for now). */
  tag: string;
  /** i18n keys: a short label and a description of what turning it on/off does. */
  labelKey: string;
  descKey: string;
  appliesTo: FeatureAppliesTo;
  /** Only offered when the node is inside a published share — the `#shared-*` visibility grammar
   *  is meaningless off a share (#1023). */
  sharedOnly?: boolean;
}

export const SYSTEM_FEATURES: readonly SystemFeature[] = [
  { tag: IN_PROGRESS_TAG, labelKey: 'features.inProgress.label', descKey: 'features.inProgress.desc', appliesTo: 'action' },
  { tag: NOT_STALLED_TAG, labelKey: 'features.notStalled.label', descKey: 'features.notStalled.desc', appliesTo: 'project' },
  { tag: SHARED_HIDE_TAG, labelKey: 'features.sharedHide.label', descKey: 'features.sharedHide.desc', appliesTo: 'both', sharedOnly: true },
  { tag: SHARED_SHOW_TAG, labelKey: 'features.sharedShow.label', descKey: 'features.sharedShow.desc', appliesTo: 'both', sharedOnly: true },
  { tag: SHARED_OPEN_TAG, labelKey: 'features.sharedOpen.label', descKey: 'features.sharedOpen.desc', appliesTo: 'project', sharedOnly: true },
];

/** The features applicable to a node, given its kind and whether it sits inside a published share.
 *  Drives which rows the Features dialog shows — the `sharedOnly` gating IS part of the UX (#1023). */
export function featuresFor(opts: { isProject: boolean; inShare: boolean }): SystemFeature[] {
  return SYSTEM_FEATURES.filter((f) => {
    if (f.sharedOnly && !opts.inShare) return false;
    if (f.appliesTo === 'both') return true;
    return f.appliesTo === (opts.isProject ? 'project' : 'action');
  });
}

