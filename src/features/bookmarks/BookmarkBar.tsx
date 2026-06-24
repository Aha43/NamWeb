import { Bookmark as BookmarkIcon, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/store/workspace-context';
import { bookmarksOf, bookmarkTarget, isBookmarkStale } from './bookmarks';

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
  const { document, dispatch } = useWorkspaceContext();
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

  if (variant === 'list') {
    return (
      <div className="flex flex-col gap-1" aria-label="Bookmarks" role="list">
        {bookmarks.map((bookmark) => {
          const stale = isBookmarkStale(document, bookmark);
          return (
            <div key={bookmark.id} role="listitem" className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`Go to bookmark: ${bookmark.label}`}
                disabled={stale}
                onClick={() => go(bookmarkTarget(bookmark))}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-accent disabled:opacity-40"
              >
                <BookmarkIcon className="h-5 w-5 shrink-0" style={stale ? undefined : { color: bookmark.color }} />
                <span className="truncate text-sm font-medium text-foreground">
                  {bookmark.label}
                  {stale && <span className="text-muted-foreground"> (no longer exists)</span>}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Remove bookmark: ${bookmark.label}`}
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
    <div className="flex items-center gap-0.5" aria-label="Bookmarks" role="list">
      {bookmarks.map((bookmark) => {
        const stale = isBookmarkStale(document, bookmark);
        const tip = stale ? `${bookmark.label} (no longer exists)` : bookmark.label;
        return (
          <div key={bookmark.id} role="listitem" className="group relative">
            <Tooltip label={tip}>
              <button
                type="button"
                aria-label={`Go to bookmark: ${bookmark.label}`}
                disabled={stale}
                onClick={() => go(bookmarkTarget(bookmark))}
                className={cn(
                  'rounded-md p-2 hover:bg-accent disabled:cursor-default disabled:opacity-40',
                  stale && 'text-muted-foreground',
                )}
              >
                <BookmarkIcon className="h-4 w-4" style={stale ? undefined : { color: bookmark.color }} />
              </button>
            </Tooltip>
            <button
              type="button"
              aria-label={`Remove bookmark: ${bookmark.label}`}
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
