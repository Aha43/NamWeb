import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Bookmark } from '@/domain/types';

/**
 * Rename one bookmark (#732). The label is the user's — independent of the project or tags
 * underneath (it's frozen at creation, never live). Duplicates are deliberately allowed: with
 * this editor they're the user's call and easy to fix. Empty labels can't be saved.
 *
 * Stays mounted, driven by `open` (the ProjectPickerDialog pattern) — unmounting a Radix dialog
 * mid-close leaks its aria-hidden on the app root and the page goes dark to the a11y tree.
 */
export function RenameBookmarkDialog({
  open,
  bookmark,
  projectName,
  onOpenChange,
  onRename,
}: {
  open: boolean;
  /** The bookmark being renamed (null while closed). */
  bookmark: Bookmark | null;
  /** The live project title, for a one-click "Use project name" (project bookmarks, non-stale). */
  projectName?: string;
  onOpenChange: (open: boolean) => void;
  onRename: (label: string) => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  // Re-seed from the bookmark on every open — the previous rename's draft must not leak in.
  useEffect(() => {
    if (open && bookmark) setLabel(bookmark.label);
  }, [open, bookmark]);

  // The commit shared by the form submit and ⌘/Ctrl+Enter (#746). Guards intact: empty refuses.
  function commit() {
    const trimmed = label.trim();
    if (!trimmed) return;
    onRename(trimmed);
    onOpenChange(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Radix portals keep React-tree bubbling — never submit a hosting form (#720/#724).
    event.stopPropagation();
    commit();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        // ⌘/Ctrl+Enter = the app-wide "commit this dialog" gesture (#746).
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.stopPropagation();
            commit();
          }
        }}
      >
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader className="text-left">
            <DialogTitle>{t('bookmarks.renameTitle')}</DialogTitle>
            <DialogDescription>{t('bookmarks.renameDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="bookmark-label">{t('bookmarks.nameLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="bookmark-label"
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              {projectName && (
                <Button type="button" variant="outline" onClick={() => setLabel(projectName)}>
                  {t('bookmarks.useProjectName')}
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!label.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
