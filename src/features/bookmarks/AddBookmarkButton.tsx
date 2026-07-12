import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { newId } from '@/lib/local';
import { useWorkspaceContext } from '@/store/workspace-context';
import {
  bookmarksOf,
  findBookmark,
  nextBookmarkColor,
  type BookmarkDraft,
} from './bookmarks';

/**
 * The "make bookmark" toggle for a surface (a project, or a tag filter). Filled when the current
 * target is already bookmarked (click removes it); outline otherwise (click adds it, assigning the
 * next palette color). Self-contained — drives the synced workspace document directly.
 */
export function AddBookmarkButton({
  draft,
  existingId,
}: {
  draft: BookmarkDraft;
  /** Pin the toggle to this bookmark id (the bookmark view, #750/F3) — the star must reflect
   *  the bookmark you're standing in, not a draft-shape match the forced Next-only can break. */
  existingId?: string;
}) {
  const { document, dispatch } = useWorkspaceContext();
  if (!document) return null;

  const bookmarks = bookmarksOf(document);
  const existing = (existingId ? bookmarks.find((b) => b.id === existingId) : undefined) ?? findBookmark(bookmarks, draft);
  const label = existing ? 'Remove bookmark' : 'Bookmark this';

  const toggle = () => {
    if (existing) {
      dispatch({ type: 'removeBookmark', id: existing.id });
    } else {
      dispatch({
        type: 'addBookmark',
        bookmark: { ...draft, id: newId(), color: nextBookmarkColor(bookmarks) },
      });
    }
  };

  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={Boolean(existing)}
        onClick={toggle}
        className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {existing ? (
          <BookmarkCheck className="h-4 w-4" style={{ color: existing.color }} />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
      </button>
    </Tooltip>
  );
}
