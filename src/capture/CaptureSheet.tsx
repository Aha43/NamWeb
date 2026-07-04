import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { InlineRename } from '@/features/actions/InlineRename';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { newId, nowIso } from '@/lib/local';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useSettings } from '@/components/settings/settings-context';
import { useIsDesktop } from '@/shell/useIsDesktop';
import type { NamNode } from '@/domain/types';

/** Clicking the delete-Undo toast is an "interact outside" for the modal capture surface — don't
 *  let it close the dialog/sheet mid-streak (#617). Toast rows render as role="status". */
function keepOpenForToast(event: { detail: { originalEvent: Event }; preventDefault: () => void }) {
  const target = event.detail.originalEvent.target;
  if (target instanceof Element && target.closest('[role="status"]')) event.preventDefault();
}

/**
 * Always-available quick capture. Stays open so you can add several in a row. On desktop it's a
 * centered modal dialog; on phones a bottom sheet (better thumb reach).
 *
 * Below the field, every item captured *this session* stays visible (so a fast streak doesn't
 * "just disappear") and is editable inline to fix a typo. Long streaks scroll in the list region
 * only — the capture field never scrolls away (#622). The list is session-only — it resets when
 * the dialog closes — but titles render live from the document, so an edit renames the real inbox
 * item and a row drops off if that item is deleted elsewhere.
 */
export function CaptureSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const { document, dispatch } = useWorkspaceContext();
  const { addToBottom } = useSettings();
  const deleteNode = useDeleteNode();
  const isDesktop = useIsDesktop();
  const [title, setTitle] = useState('');
  // Ids captured during this open; newest first. Cleared when the dialog closes (non-persisted).
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRecentIds([]);
      setRenamingId(null);
    }
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const id = newId();
    dispatch({ type: 'addInboxItem', id, title: trimmed, atTop: !addToBottom, now: nowIso() });
    setRecentIds((prev) => [id, ...prev]);
    setTitle('');
  }

  function rename(id: string, nextTitle: string) {
    const node = document?.nodes[id];
    if (node) dispatch({ type: 'updateNode', id, title: nextTitle, description: node.description, now: nowIso() });
  }

  const form = (
    <form onSubmit={submit} className="mt-4 flex gap-2">
      <input
        aria-label={t('capture.inputAria')}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('capture.placeholder')}
        className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
      />
      <Button type="submit" className="shrink-0">{t('common.add')}</Button>
    </form>
  );

  // Live lookup so edits/deletions elsewhere reflect immediately; drop ids whose node is gone.
  const recentNodes = recentIds
    .map((id) => document?.nodes[id])
    .filter((n): n is NamNode => Boolean(n));

  // The list is the only scroll region (min-h-0 + overflow-y-auto): however long the streak, the
  // header and capture field stay put (#622).
  const recentList =
    recentNodes.length > 0 ? (
      <div className="mt-4 flex min-h-0 flex-col gap-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{t('capture.justAdded')}</p>
        <ul className="min-h-0 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {recentNodes.map((node) => (
            <li key={node.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              {renamingId === node.id ? (
                <div className="min-w-0 flex-1">
                  <InlineRename
                    title={node.title}
                    onCommit={(newTitle) => {
                      rename(node.id, newTitle);
                      setRenamingId(null);
                    }}
                    onCancel={() => setRenamingId(null)}
                  />
                </div>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-foreground">{node.title}</span>
                  <CopyButton value={node.title} label={t('copy.name', { title: node.title })} tooltip />
                  <button
                    type="button"
                    aria-label={t('actions.editAria', { title: node.title })}
                    onClick={() => setRenamingId(node.id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {/* No confirm — these are seconds-old leaf captures and the toast offers Undo. */}
                  <button
                    type="button"
                    aria-label={t('actions.deleteAria', { title: node.title })}
                    onClick={() => deleteNode(node.id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const description = t('capture.description');

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* flex-col + overflow-hidden: the content itself never scrolls (the default DialogContent
            behavior would scroll the capture field away on a long streak) — only the list does. */}
        <DialogContent className="flex flex-col overflow-hidden" onInteractOutside={keepOpenForToast}>
          <DialogHeader>
            <DialogTitle>{t('nav.capture')}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {form}
          {recentList}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The bottom sheet is content-height with no cap of its own — bound it so a long streak
          scrolls in the list instead of growing past the top of the viewport. */}
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col overflow-hidden" onInteractOutside={keepOpenForToast}>
        <SheetHeader>
          <SheetTitle>{t('nav.capture')}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {form}
        {recentList}
      </SheetContent>
    </Sheet>
  );
}
