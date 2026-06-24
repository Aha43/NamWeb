import { Bookmark as BookmarkIcon, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/store/workspace-context';
import { bookmarksOf, bookmarkTarget, isBookmarkStale } from './bookmarks';

/**
 * The toolbar strip of saved bookmarks — each a colored bookmark icon that jumps to its target
 * (a project or a tag filter); the tooltip names it. Hover reveals a small × to remove it. A stale
 * project bookmark (project gone) is greyed and not clickable, but can still be removed.
 */
export function BookmarkBar() {
  const { document, dispatch } = useWorkspaceContext();
  const navigate = useNavigate();
  if (!document) return null;

  const bookmarks = bookmarksOf(document);
  if (bookmarks.length === 0) return null;

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
                onClick={() => navigate(bookmarkTarget(bookmark))}
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
              className="absolute -right-0.5 -top-0.5 hidden rounded-full bg-muted p-0.5 text-muted-foreground hover:text-destructive group-hover:block group-focus-within:block"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
