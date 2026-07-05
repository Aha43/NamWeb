import { Bookmark as BookmarkIcon, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useSettings } from '@/components/settings/settings-context';
import { ReorderControls } from '@/features/actions/ReorderControls';
import { bookmarksOf, bookmarkTarget, isBookmarkStale, movedBookmarkOrder } from './bookmarks';

/**
 * Saved bookmarks — each jumps to its target (a project or a tag filter). Two layouts:
 *   - `bar` (default): a compact horizontal strip of colored icons, named by tooltip — the desktop
 *     toolbar.
 *   - `list`: vertical rows with **visible labels** — for the phone "More" sheet, where tooltips
 *     don't fire on touch.
 * The remove ✕ shows on hover *and on touch* (where there is no hover). A stale project bookmark
 * (project gone) is greyed and not clickable, but can still be removed.
 */
export function BookmarkBar({
  variant = 'bar',
  onNavigate,
}: {
  variant?: 'bar' | 'list';
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { document, dispatch } = useWorkspaceContext();
  const { bookmarkStyle } = useSettings();
  const navigate = useNavigate();
  if (!document) return null;

  const bookmarks = bookmarksOf(document);
  if (bookmarks.length === 0) return null;

  const go = (target: string) => {
    navigate(target);
    onNavigate?.();
  };
  // Reveal the remove control on hover, keyboard focus, OR any touch device (no hover to rely on).
  const removeVisibility = 'hidden group-hover:block group-focus-within:block [@media(hover:none)]:block';

  // Reorder within the mixed list this surface shows (#636).
  const move = (id: string, direction: 'up' | 'down') => {
    const order = movedBookmarkOrder(document, bookmarks, id, direction);
    if (order) dispatch({ type: 'reorderBookmarks', order });
  };

  if (variant === 'list') {
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

  return (
    <div className="flex items-center gap-0.5" aria-label={t('nav.bookmarks')} role="list">
      {bookmarks.map((bookmark) => {
        const stale = isBookmarkStale(document, bookmark);
        const tip = stale ? t('bookmarks.staleTip', { label: bookmark.label }) : bookmark.label;
        return (
          <div key={bookmark.id} role="listitem" className="group relative">
            <Tooltip label={tip}>
              <button
                type="button"
                aria-label={t('bookmarks.goToAria', { label: bookmark.label })}
                disabled={stale}
                onClick={() => go(bookmarkTarget(bookmark))}
                className={cn(
                  'flex items-center gap-1.5 rounded-md hover:bg-accent disabled:cursor-default disabled:opacity-40',
                  bookmarkStyle === 'labels' ? 'px-2 py-1.5' : 'p-2',
                  stale && 'text-muted-foreground',
                )}
              >
                <BookmarkIcon className="h-4 w-4 shrink-0" style={stale ? undefined : { color: bookmark.color }} />
                {bookmarkStyle === 'labels' && (
                  <span className="max-w-[9rem] truncate text-sm font-medium text-foreground">{bookmark.label}</span>
                )}
              </button>
            </Tooltip>
            <button
              type="button"
              aria-label={t('bookmarks.removeAria', { label: bookmark.label })}
              onClick={() => dispatch({ type: 'removeBookmark', id: bookmark.id })}
              className={cn(
                'absolute -right-0.5 -top-0.5 rounded-full bg-muted p-0.5 text-muted-foreground hover:text-destructive',
                removeVisibility,
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
