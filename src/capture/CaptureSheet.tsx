import { useEffect, useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InlineRename } from '@/features/actions/InlineRename';
import { newId, nowIso } from '@/lib/local';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useSettings } from '@/components/settings/settings-context';
import { useIsDesktop } from '@/shell/useIsDesktop';
import type { NamNode } from '@/domain/types';

/** How many recently-captured items to keep visible in the dialog. */
const RECENT_LIMIT = 4;

/**
 * Always-available quick capture. Stays open so you can add several in a row. On desktop it's a
 * centered modal dialog; on phones a bottom sheet (better thumb reach).
 *
 * Below the field, the last few items captured *this session* stay visible (so a fast streak doesn't
 * "just disappear") and are editable inline to fix a typo. The list is session-only — it resets when
 * the dialog closes — but titles render live from the document, so an edit renames the real inbox
 * item and a row drops off if that item is deleted elsewhere.
 */
export function CaptureSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { document, dispatch } = useWorkspaceContext();
  const { addToBottom } = useSettings();
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
    setRecentIds((prev) => [id, ...prev].slice(0, RECENT_LIMIT));
    setTitle('');
  }

  function rename(id: string, nextTitle: string) {
    const node = document?.nodes[id];
    if (node) dispatch({ type: 'updateNode', id, title: nextTitle, description: node.description, now: nowIso() });
  }

  const form = (
    <form onSubmit={submit} className="mt-4 flex gap-2">
      <input
        aria-label="Capture to inbox"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's on your mind?"
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
      />
      <Button type="submit">Add</Button>
    </form>
  );

  // Live lookup so edits/deletions elsewhere reflect immediately; drop ids whose node is gone.
  const recentNodes = recentIds
    .map((id) => document?.nodes[id])
    .filter((n): n is NamNode => Boolean(n));

  const recentList =
    recentNodes.length > 0 ? (
      <div className="mt-4 space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">Just added</p>
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {recentNodes.map((node) => (
            <li key={node.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              {renamingId === node.id ? (
                <div className="flex-1">
                  <InlineRename
                    title={node.title}
                    onCommit={(t) => {
                      rename(node.id, t);
                      setRenamingId(null);
                    }}
                    onCancel={() => setRenamingId(null)}
                  />
                </div>
              ) : (
                <>
                  <span className="flex-1 truncate text-foreground">{node.title}</span>
                  <button
                    type="button"
                    aria-label={`Edit ${node.title}`}
                    onClick={() => setRenamingId(node.id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const description = 'Add to your inbox. Keep typing to add several.';

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Capture</DialogTitle>
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
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Capture</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {form}
        {recentList}
      </SheetContent>
    </Sheet>
  );
}
