// Pure helpers for toolbar bookmarks: the color palette, the navigation target, duplicate
// detection, and stale-project detection. Kept transport-free (domain types only).

import type { Bookmark, WorkspaceDocument } from '@/domain/types';
import { tagFilterParams } from '@/features/tags/tagFilterParams';

/** A small fixed palette — bookmarks cycle through it so each gets a distinct, learnable color. */
export const BOOKMARK_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
] as const;

/** The next color to assign, cycling through the palette by current bookmark count. */
export function nextBookmarkColor(existing: Bookmark[]): string {
  return BOOKMARK_COLORS[existing.length % BOOKMARK_COLORS.length];
}

/** A bookmark without its generated id/color — the "draft" a surface offers to save. */
export type BookmarkDraft = Omit<Bookmark, 'id' | 'color'>;

/** Always-an-array accessor (the field is optional on older/desktop documents). */
export function bookmarksOf(doc: WorkspaceDocument): Bookmark[] {
  return doc.bookmarks ?? [];
}

/** Does this draft already exist (same kind + same target)? Returns the matching bookmark, if any. */
export function findBookmark(bookmarks: Bookmark[], draft: BookmarkDraft): Bookmark | undefined {
  return bookmarks.find((b) => {
    if (b.kind !== draft.kind) return false;
    if (draft.kind === 'project') return b.projectId === draft.projectId;
    // tagFilter: same set of tags (order-insensitive) and same nextOnly.
    const a = [...(b.tags ?? [])].sort();
    const c = [...(draft.tags ?? [])].sort();
    return Boolean(b.nextOnly) === Boolean(draft.nextOnly) && a.length === c.length && a.every((t, i) => t === c[i]);
  });
}

/** The in-app route a bookmark jumps to. */
export function bookmarkTarget(bookmark: Bookmark): string {
  if (bookmark.kind === 'project') return `/projects/${bookmark.projectId}`;
  const params = tagFilterParams(bookmark.tags ?? [], Boolean(bookmark.nextOnly)).toString();
  return params ? `/tags?${params}` : '/tags';
}

/** A project bookmark whose project no longer exists (or is no longer a project) is stale. */
export function isBookmarkStale(doc: WorkspaceDocument, bookmark: Bookmark): boolean {
  if (bookmark.kind !== 'project') return false;
  const node = bookmark.projectId ? doc.nodes[bookmark.projectId] : undefined;
  return !node || !node.project;
}
