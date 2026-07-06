// Built-in "system" tags (#651): stored as perfectly ordinary tags in the shared workspace
// document (NamDesktop sees plain tags — no contract change), but the web UI treats them
// specially: always offered in suggestions and filters, protected from rename/delete, and
// rendered bold so they read as part of the system rather than user vocabulary.

/** Marks the action you're actively working on — orthogonal to status (a Backlog item you've
 *  started but are waiting on is legitimately both). */
export const IN_PROGRESS_TAG = 'in progress';

export const SYSTEM_TAGS: readonly string[] = [IN_PROGRESS_TAG];

export function isSystemTag(tag: string): boolean {
  return SYSTEM_TAGS.includes(tag.trim().toLowerCase());
}
