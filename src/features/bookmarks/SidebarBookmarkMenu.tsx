import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Ellipsis } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/store/workspace-context';
import { allOpenableProjects } from '@/domain/lenses';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';
import { ReorderControls } from '@/features/actions/ReorderControls';
import { bookmarkTarget, liveBookmarksOfKind, movedBookmarkOrder } from './bookmarks';
import type { Bookmark } from '@/domain/types';

/**
 * A kind-scoped bookmark quick-jump menu for the command bar (#588): just the chevron trigger +
 * the dropdown — the caller composes it beside its Projects/Contexts button as a split-button (the
 * label keeps navigating; the chevron opens the list). Renders nothing when the kind has no live
 * bookmarks, so callers can drop it in unconditionally. Stale project bookmarks are filtered out
 * (removal lives on the bookmarked surfaces and the phone list).
 *
 * Project bookmark rows are themselves split (#595): the label opens the project directly; the
 * trailing "…" opens the Finder-style picker **already navigated to that project** — bookmarks as
 * starting points, drill to a neighbour/descendant and Open it. (Two menu items per row rather
 * than a button nested inside an item, so menu semantics stay intact.)
 */
export function SidebarBookmarkMenu({ kind, className }: { kind: Bookmark['kind']; className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { document, dispatch } = useWorkspaceContext();
  // The project id the "…" picker starts from; null = picker closed.
  const [browseFrom, setBrowseFrom] = useState<string | null>(null);
  const bookmarks = document ? liveBookmarksOfKind(document, kind) : [];
  if (!document || bookmarks.length === 0) return null;
  const aria = kind === 'project' ? t('bookmarks.projectMenuAria') : t('bookmarks.contextMenuAria');
  // Reorder within this menu's visible (kind-filtered) list; unshown kinds keep their slots (#636).
  const move = (id: string, direction: 'up' | 'down') => {
    const order = movedBookmarkOrder(document, bookmarks, id, direction);
    if (order) dispatch({ type: 'reorderBookmarks', order });
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={aria} className={cn('h-9 w-7 shrink-0', className)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {bookmarks.map((bookmark, index) => (
            <div key={bookmark.id} className="flex items-center">
              {/* Plain buttons (not menu items): reordering keeps the menu open to keep fiddling. */}
              <ReorderControls
                title={bookmark.label}
                onUp={index > 0 ? () => move(bookmark.id, 'up') : undefined}
                onDown={index < bookmarks.length - 1 ? () => move(bookmark.id, 'down') : undefined}
              />
              <DropdownMenuItem
                className="min-w-0 flex-1"
                onClick={() => navigate(bookmarkTarget(bookmark))}
              >
                <span
                  aria-hidden
                  className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: bookmark.color }}
                />
                <span className="max-w-[14rem] truncate">{bookmark.label}</span>
              </DropdownMenuItem>
              {kind === 'project' && bookmark.projectId && (
                <DropdownMenuItem
                  aria-label={t('bookmarks.browseFromAria', { label: bookmark.label })}
                  className="shrink-0 px-2 text-muted-foreground"
                  onClick={() => setBrowseFrom(bookmark.projectId!)}
                >
                  <Ellipsis className="h-4 w-4" />
                </DropdownMenuItem>
              )}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {kind === 'project' && (
        <ProjectPickerDialog
          open={browseFrom !== null}
          onOpenChange={(open) => {
            if (!open) setBrowseFrom(null);
          }}
          title={t('picker.openTitle')}
          confirmLabel={t('picker.open')}
          targets={allOpenableProjects(document)}
          initialProjectId={browseFrom ?? undefined}
          onConfirm={(id) => navigate(`/projects/${id}`)}
        />
      )}
    </>
  );
}
