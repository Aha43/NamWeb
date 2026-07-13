// Built-in "system" tags (#651): stored as perfectly ordinary tags in the shared workspace
// document (NamDesktop sees plain tags — no contract change), but the web UI treats them
// specially: always offered in suggestions and filters, protected from rename/delete, and
// rendered bold so they read as part of the system rather than user vocabulary.

/** Marks the action you're actively working on — orthogonal to status (a Backlog item you've
 *  started but are waiting on is legitimately both). */
export const IN_PROGRESS_TAG = 'in progress';

/** Keeps a node (and its whole subtree) OUT of a published project share (#759) — the
 *  opt-out half of the sharing visibility grammar: publishing is opt-in per project, this
 *  tag hides "budget ceiling" / "surprise for mum" nodes within it. */
export const PRIVATE_TAG = 'private';

export const SYSTEM_TAGS: readonly string[] = [IN_PROGRESS_TAG, PRIVATE_TAG];

export function isSystemTag(tag: string): boolean {
  return SYSTEM_TAGS.includes(tag.trim().toLowerCase());
}

/** The canonical (lowercase) form of a tag when it's a system tag — shared documents can carry
 *  case variants written by NamDesktop ("In Progress"); web-side handling collapses them. */
export function canonicalTag(tag: string): string {
  return isSystemTag(tag) ? tag.trim().toLowerCase() : tag;
}
