import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { NamNode } from '@/domain/types';

export interface DeleteDisposition {
  /** Keep the project's direct actions (move them out) rather than delete them. */
  keepActions: boolean;
  /** Keep the project's direct sub-projects (move them out) rather than delete them. */
  keepSubProjects: boolean;
}

/**
 * Advanced delete for a project: for a non-empty project, choose whether its direct **actions** and
 * **sub-projects** move up (to the parent project, or Top level / Free actions when deleting a
 * top-level project) or get deleted with it. Empty projects just confirm. Undoable either way.
 */
export function DeleteProjectDialog({
  project,
  isTopLevel,
  actionCount,
  subCount,
  onCancel,
  onConfirm,
}: {
  /** The project being deleted; `null` keeps the dialog closed. */
  project: NamNode | null;
  isTopLevel: boolean;
  actionCount: number;
  subCount: number;
  onCancel: () => void;
  onConfirm: (disposition: DeleteDisposition) => void;
}) {
  // Default to keeping content (move up) — never lose work by accident.
  const [keepActions, setKeepActions] = useState(true);
  const [keepSubProjects, setKeepSubProjects] = useState(true);

  if (!project) return null;
  const hasContent = actionCount > 0 || subCount > 0;
  const actionTarget = isTopLevel ? 'Free actions' : 'the parent project';
  const subTarget = isTopLevel ? 'Top level' : 'the parent project';
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{project.title}”?</DialogTitle>
          <DialogDescription>
            {hasContent ? 'Choose what happens to its contents. You can undo this.' : 'This can be undone.'}
          </DialogDescription>
        </DialogHeader>

        {hasContent && (
          <div className="space-y-4 py-1">
            {actionCount > 0 && (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium text-foreground">Its {plural(actionCount, 'action')}</legend>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="delete-actions" checked={keepActions} onChange={() => setKeepActions(true)} />
                  Move the actions to {actionTarget}
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="delete-actions" checked={!keepActions} onChange={() => setKeepActions(false)} />
                  Delete the actions
                </label>
              </fieldset>
            )}
            {subCount > 0 && (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium text-foreground">Its {plural(subCount, 'sub-project')}</legend>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="delete-subs"
                    checked={keepSubProjects}
                    onChange={() => setKeepSubProjects(true)}
                  />
                  Move the sub-projects to {subTarget}
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="delete-subs"
                    checked={!keepSubProjects}
                    onChange={() => setKeepSubProjects(false)}
                  />
                  Delete the sub-projects
                </label>
              </fieldset>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" autoFocus onClick={() => onConfirm({ keepActions, keepSubProjects })}>
            Delete project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
