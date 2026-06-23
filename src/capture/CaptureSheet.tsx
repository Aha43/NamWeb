import { useState, type FormEvent } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { newId, nowIso } from '@/lib/local';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useIsDesktop } from '@/shell/useIsDesktop';

/**
 * Always-available quick capture. Stays open so you can add several in a row. On desktop it's a
 * centered modal dialog; on phones a bottom sheet (better thumb reach).
 */
export function CaptureSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { dispatch } = useWorkspaceContext();
  const isDesktop = useIsDesktop();
  const [title, setTitle] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    dispatch({ type: 'addInboxItem', id: newId(), title: trimmed, now: nowIso() });
    setTitle('');
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
      </SheetContent>
    </Sheet>
  );
}
