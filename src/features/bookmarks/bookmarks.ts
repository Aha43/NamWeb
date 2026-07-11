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

/**
 * The full stored order after moving `id` one step among `visible` — the bookmarks a surface
 * actually displays, which is a *subsequence* of the stored list (a kind-filtered menu, or the
 * phone's mixed list). The two ids swap their slots in the stored order, so bookmarks the surface
 * doesn't show keep their positions. Null when the move falls off the visible list's end (the
 * caller disables that chevron). For the `reorderBookmarks` intent (#636).
 */
export function movedBookmarkOrder(
  doc: WorkspaceDocument,
  visible: Bookmark[],
  id: string,
  direction: 'up' | 'down',
): string[] | null {
  const k = visible.findIndex((b) => b.id === id);
  const j = direction === 'up' ? k - 1 : k + 1;
  if (k < 0 || j < 0 || j >= visible.length) return null;
  const order = bookmarksOf(doc).map((b) => b.id);
  const ki = order.indexOf(visible[k].id);
  const ji = order.indexOf(visible[j].id);
  [order[ki], order[ji]] = [order[ji], order[ki]];
  return order;
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

/** The speed-dial route (#738): focus scoped to the bookmark — the deck, not the view. Both
 *  scopes are long-standing FocusPage URLs (project = the workbench Focus semantics). */
export function bookmarkFocusTarget(bookmark: Bookmark): string {
  if (bookmark.kind === 'project') return `/focus?project=${bookmark.projectId}`;
  const params = tagFilterParams(bookmark.tags ?? [], Boolean(bookmark.nextOnly)).toString();
  return params ? `/focus?${params}` : '/focus';
}

/** A project bookmark whose project no longer exists (or is no longer a project) is stale. */
export function isBookmarkStale(doc: WorkspaceDocument, bookmark: Bookmark): boolean {
  if (bookmark.kind !== 'project') return false;
  const node = bookmark.projectId ? doc.nodes[bookmark.projectId] : undefined;
  return !node || !node.project;
}

/** Bookmarks of one kind, minus stale ones — what the sidebar quick-jump menus list (#588). */
export function liveBookmarksOfKind(doc: WorkspaceDocument, kind: Bookmark['kind']): Bookmark[] {
  return bookmarksOf(doc).filter((b) => b.kind === kind && !isBookmarkStale(doc, b));
}
