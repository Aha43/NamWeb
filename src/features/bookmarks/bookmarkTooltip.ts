import type { TFunction } from 'i18next';
import type { Bookmark, WorkspaceDocument } from '@/domain/types';
import { projectPath } from '@/domain/lenses';
import { isBookmarkStale } from './bookmarks';

/**
 * The technical truth behind a bookmark's label (#732): the full project path, or the tag
 * selection — a renamed bookmark stays legible on hover. Stale rows return '' (they carry
 * their own suffix instead; Tooltip renders the bare child on a falsy label). Shared by the
 * kind-scoped menus and the Focus speed dial (#738).
 */
export function bookmarkTooltip(doc: WorkspaceDocument, bookmark: Bookmark, t: TFunction): string {
  if (isBookmarkStale(doc, bookmark)) return '';
  if (bookmark.kind === 'project' && bookmark.projectId) {
    const node = doc.nodes[bookmark.projectId];
    return [...projectPath(doc, node.id), node.title].join(' › ');
  }
  const tags = (bookmark.tags ?? []).join(', ');
  return bookmark.nextOnly ? t('bookmarks.tagsTooltipNext', { tags }) : tags;
}
