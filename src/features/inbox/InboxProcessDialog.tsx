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
}: {
  node: NamNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (resolution: ProcessResolution) => void;
}) {
  const [step, setStep] = useState<'kind' | 'action'>('kind');

  function resolve(resolution: ProcessResolution) {
    onResolve(resolution);
    onOpenChange(false);
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
          <DialogTitle>Process item</DialogTitle>
          <DialogDescription className="truncate">{node.title}</DialogDescription>
        </DialogHeader>

        {step === 'kind' ? (
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start" onClick={() => setStep('action')}>
              It’s one action
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => resolve({ kind: 'project' })}>
              It needs planning — make a project
            </Button>
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
