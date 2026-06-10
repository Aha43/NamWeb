import { useState, type FormEvent } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { newId, nowIso } from '@/lib/local';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useIsDesktop } from '@/shell/useIsDesktop';

/** Always-available quick capture. Stays open so you can add several in a row. */
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isDesktop ? 'right' : 'bottom'}>
        <SheetHeader>
          <SheetTitle>Capture</SheetTitle>
          <SheetDescription>Add to your inbox. Keep typing to add several.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input
            aria-label="Capture to inbox"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's on your mind?"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-ring"
          />
          <Button type="submit">Add</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
