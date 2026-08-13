import type { Bookmark, WorkspaceDocument } from '@/domain/types';
import { projectPath } from '@/domain/lenses';
import { isBookmarkStale } from './bookmarks';

/**
 * The technical truth behind a bookmark's label (#732): the full project path — a renamed bookmark
 * stays legible on hover. Stale rows return '' (they carry their own suffix instead; Tooltip renders
 * the bare child on a falsy label). Shared by the bookmark menu and the Focus speed dial (#738).
 */
export function bookmarkTooltip(doc: WorkspaceDocument, bookmark: Bookmark): string {
  if (isBookmarkStale(doc, bookmark)) return '';
  const node = doc.nodes[bookmark.projectId];
  return [...projectPath(doc, node.id), node.title].join(' › ');
}
