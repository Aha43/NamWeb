import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/store/workspace-context';
import { bookmarkFocusTarget, bookmarksOf, isBookmarkStale } from './bookmarks';
import { bookmarkTooltip } from './bookmarkTooltip';

/**
 * The Focus speed dial (#738): a chevron beside the command bar's Focus entry — the same
 * split-button shape as Projects ▾ / Contexts ▾ (#588) — listing **all** bookmarks (both kinds,
 * stored order). Clicking a row deals the deck scoped to the bookmark instead of opening its
 * view: a project bookmark focuses its open direct actions (the workbench Focus semantics), a
 * context bookmark focuses its tag filter. The dial is a pure projection of the bookmarks you
 * already curate — management (reorder/rename/remove/browse) stays in the kind-scoped menus;
 * here rows navigate, nothing else. Renders nothing when there are no bookmarks at all.
 */
export function FocusBookmarkMenu({ className }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { document, dispatch } = useWorkspaceContext();
  const bookmarks = document ? bookmarksOf(document) : [];
  if (!document || bookmarks.length === 0) return null;
  const aria = t('bookmarks.focusMenuAria');
  return (
    <DropdownMenu>
      {/* Tooltip outside the trigger: both asChild layers clone onto the same Button (#679). */}
      <Tooltip label={aria}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={aria} className={cn('h-9 w-7 shrink-0', className)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="start">
        {bookmarks.map((bookmark) => {
          const stale = isBookmarkStale(document, bookmark);
          // A stale bookmark (its project was deleted) can't be focused — but you must be able to clear
          // it from here rather than hunt for the bookmark bar (#937). The row becomes a remove action.
          if (stale) {
            return (
              <Tooltip key={bookmark.id} label={t('bookmarks.removeAria', { label: bookmark.label })} side="bottom">
                <DropdownMenuItem
                  aria-label={t('bookmarks.removeAria', { label: bookmark.label })}
                  className="min-w-0 text-muted-foreground"
                  onClick={() => dispatch({ type: 'removeBookmark', id: bookmark.id })}
                >
                  <X aria-hidden className="mr-2 h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[14rem] truncate">
                    {bookmark.label}
                    <span>{t('bookmarks.staleSuffix')}</span>
                  </span>
                </DropdownMenuItem>
              </Tooltip>
            );
          }
          return (
            // side=bottom, as in the kind-scoped menus (#732) — a right-side tooltip intercepts.
            <Tooltip key={bookmark.id} label={bookmarkTooltip(document, bookmark, t)} side="bottom">
              <DropdownMenuItem
                aria-label={t('bookmarks.focusRowAria', { label: bookmark.label })}
                className="min-w-0"
                onClick={() => navigate(bookmarkFocusTarget(bookmark))}
              >
                <span
                  aria-hidden
                  className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: bookmark.color }}
                />
                <span className="max-w-[14rem] truncate">{bookmark.label}</span>
              </DropdownMenuItem>
            </Tooltip>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
