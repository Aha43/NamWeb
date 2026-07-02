import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/store/workspace-context';
import { bookmarkTarget, liveBookmarksOfKind } from './bookmarks';
import type { Bookmark } from '@/domain/types';

/**
 * A kind-scoped bookmark quick-jump menu for the sidebar (#588): just the chevron trigger + the
 * dropdown — the caller composes it beside its Projects/Contexts button as a split-button (the
 * label keeps navigating; the chevron opens the list). Renders nothing when the kind has no live
 * bookmarks, so callers can drop it in unconditionally. Items are navigation-only; stale project
 * bookmarks are filtered out (removal lives on the bookmarked surfaces and the phone list).
 */
export function SidebarBookmarkMenu({ kind, className }: { kind: Bookmark['kind']; className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { document } = useWorkspaceContext();
  const bookmarks = document ? liveBookmarksOfKind(document, kind) : [];
  if (bookmarks.length === 0) return null;
  const aria = kind === 'project' ? t('bookmarks.projectMenuAria') : t('bookmarks.contextMenuAria');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={aria} className={cn('h-9 w-7 shrink-0', className)}>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {bookmarks.map((bookmark) => (
          <DropdownMenuItem key={bookmark.id} onClick={() => navigate(bookmarkTarget(bookmark))}>
            <span
              aria-hidden
              className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: bookmark.color }}
            />
            <span className="max-w-[14rem] truncate">{bookmark.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
