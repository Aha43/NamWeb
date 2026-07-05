import { Bookmark as BookmarkIcon, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWorkspaceContext } from '@/store/workspace-context';
import { ReorderControls } from '@/features/actions/ReorderControls';
import { bookmarksOf, bookmarkTarget, isBookmarkStale, movedBookmarkOrder } from './bookmarks';

/**
 * The phone More-sheet bookmark list: vertical rows with **visible labels** (tooltips don't fire on
 * touch), reorder chevrons (#636), and a per-row remove ✕. A stale project bookmark (project gone)
 * is greyed and not clickable, but can still be removed. Each row jumps to its target (a project
 * or a tag filter).
 *
 * (The old desktop toolbar `bar` variant was pruned in #593 — desktop bookmarks live behind the
 * command-bar chevron menus, #588.)
 */
export function BookmarkBar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { document, dispatch } = useWorkspaceContext();
  const navigate = useNavigate();
  if (!document) return null;

  const bookmarks = bookmarksOf(document);
  if (bookmarks.length === 0) return null;

  const go = (target: string) => {
    navigate(target);
    onNavigate?.();
  };
  // Reorder within the mixed list this surface shows (#636).
  const move = (id: string, direction: 'up' | 'down') => {
    const order = movedBookmarkOrder(document, bookmarks, id, direction);
    if (order) dispatch({ type: 'reorderBookmarks', order });
  };

  return (
    <div className="flex flex-col gap-1" aria-label={t('nav.bookmarks')} role="list">
      {bookmarks.map((bookmark, index) => {
        const stale = isBookmarkStale(document, bookmark);
        return (
          <div key={bookmark.id} role="listitem" className="flex items-center gap-1">
            <ReorderControls
              title={bookmark.label}
              onUp={index > 0 ? () => move(bookmark.id, 'up') : undefined}
              onDown={index < bookmarks.length - 1 ? () => move(bookmark.id, 'down') : undefined}
            />
            <button
              type="button"
              aria-label={t('bookmarks.goToAria', { label: bookmark.label })}
              disabled={stale}
              onClick={() => go(bookmarkTarget(bookmark))}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-accent disabled:opacity-40"
            >
              <BookmarkIcon className="h-5 w-5 shrink-0" style={stale ? undefined : { color: bookmark.color }} />
              <span className="truncate text-sm font-medium text-foreground">
                {bookmark.label}
                {stale && <span className="text-muted-foreground">{t('bookmarks.staleSuffix')}</span>}
              </span>
            </button>
            <button
              type="button"
              aria-label={t('bookmarks.removeAria', { label: bookmark.label })}
              onClick={() => dispatch({ type: 'removeBookmark', id: bookmark.id })}
              className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
