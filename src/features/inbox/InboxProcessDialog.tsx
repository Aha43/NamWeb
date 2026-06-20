import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { NamNode } from '@/domain/types';

/** The outcome of processing an inbox item. */
export type ProcessResolution =
  | { kind: 'project' }
  | { kind: 'action'; status: 'NEXT' | 'BACKLOG' };

/**
 * Clarify an inbox item: is it one action or does it need planning (a project)?
 * If an action, do it next or park it for later. Mirrors NamDesktop's
 * ProcessInboxDialog. Presentational — reports the choice via `onResolve`.
 */
export function InboxProcessDialog({
  node,
  open,
  onOpenChange,
  onResolve,
  onDelete,
  onSkip,
  remaining,
}: {
  node: NamNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (resolution: ProcessResolution) => void;
  /** Deck mode (process-all): delete the current item and advance. */
  onDelete?: () => void;
  /** Deck mode: leave the item in the inbox and advance to the next. */
  onSkip?: () => void;
  /** Deck mode: how many items are left (incl. the current one). */
  remaining?: number;
}) {
  const [step, setStep] = useState<'kind' | 'action'>('kind');
  const deck = Boolean(onSkip); // process-all flow: parent swaps in the next item

  function resolve(resolution: ProcessResolution) {
    onResolve(resolution);
    if (!deck) onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setStep('kind');
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deck ? 'Process inbox' : 'Process item'}</DialogTitle>
          <DialogDescription className="truncate">
            {node.title}
            {deck && remaining ? ` · ${remaining} left` : ''}
          </DialogDescription>
        </DialogHeader>

        {step === 'kind' ? (
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start" onClick={() => setStep('action')}>
              It’s one action
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => resolve({ kind: 'project' })}>
              It needs planning — make a project
            </Button>
            {deck && (
              <div className="mt-1 flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 text-destructive" onClick={onDelete}>
                  Delete
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={onSkip}>
                  Skip →
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button className="justify-start" onClick={() => resolve({ kind: 'action', status: 'NEXT' })}>
              Do it next
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => resolve({ kind: 'action', status: 'BACKLOG' })}
            >
              Park for later (backlog)
            </Button>
            <Button variant="ghost" className="justify-start" onClick={() => setStep('kind')}>
              ← Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
