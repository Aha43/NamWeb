import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { parseFlexibleDate } from '@/lib/dates';
import type { NamNode, NodeStatus } from '@/domain/types';

/** The edited fields the dialog produces on save. Tags are raw (un-normalized). */
export interface ActionEdits {
  title: string;
  description: string | null;
  tags: string[];
  dueAt: string | null;
  status: NodeStatus;
}

const STATUSES: { value: NodeStatus; label: string }[] = [
  { value: 'NEXT', label: 'Next' },
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'DONE', label: 'Done' },
];

/**
 * Edit an action's title, description, tags, due date, and status. Presentational:
 * seeded from `node`, it reports the edited fields via `onSave` and never mutates.
 * Mirrors NamDesktop's ActionDialog (blockers/resources/move are later sprints).
 */
/** A reparent target: a project, or the special "Free actions" container. */
export interface MoveTarget {
  id: string;
  label: string;
}

/** A current prerequisite of the action. */
export interface Blocker {
  id: string;
  title: string;
  done: boolean;
}

export function ActionDialog({
  node,
  open,
  onOpenChange,
  onSave,
  onMakeProject,
  moveTargets,
  onMove,
  blockers,
  blockerCandidates,
  wouldUnblock,
  onAddPrerequisite,
  onRemovePrerequisite,
}: {
  node: NamNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (edits: ActionEdits) => void;
  onMakeProject?: () => void;
  moveTargets?: MoveTarget[];
  onMove?: (targetId: string) => void;
  blockers?: Blocker[];
  blockerCandidates?: MoveTarget[];
  wouldUnblock?: string[];
  onAddPrerequisite?: (prereqId: string) => void;
  onRemovePrerequisite?: (prereqId: string) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description ?? '');
  const [tags, setTags] = useState(node.tags.join(', '));
  const [due, setDue] = useState(node.dueAt ?? '');
  const [dueError, setDueError] = useState(false);
  const [status, setStatus] = useState<NodeStatus>(node.status);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const dueAt = parseFlexibleDate(due);
    if (due.trim() && dueAt === null) {
      setDueError(true);
      return;
    }
    const trimmedDescription = description.trim();
    onSave({
      title: trimmedTitle,
      description: trimmedDescription ? trimmedDescription : null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      dueAt,
      status,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit action</DialogTitle>
          <DialogDescription>Update the title, notes, tags, due date, and status.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="action-title">Title</Label>
            <Input id="action-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="action-description">Description</Label>
            <Textarea
              id="action-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="action-tags">Tags</Label>
              <Input
                id="action-tags"
                placeholder="comma, separated"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="action-due">Due</Label>
              <Input
                id="action-due"
                placeholder="26-7-4"
                value={due}
                aria-invalid={dueError}
                onChange={(e) => {
                  setDue(e.target.value);
                  if (dueError) setDueError(false);
                }}
                onBlur={() => {
                  // Echo a canonical zero-padded ISO form (26-7-4 → 2026-07-04) to confirm
                  // what was parsed. Leave unparseable text untouched (don't nag on blur).
                  const iso = parseFlexibleDate(due);
                  if (iso) setDue(iso);
                }}
              />
              {dueError && (
                <p role="alert" className="text-xs text-destructive">
                  Use a date like 26-7-4 or 2026-07-04.
                </p>
              )}
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">Status</legend>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <label
                  key={s.value}
                  className={cn(
                    'cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    status === s.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <input
                    type="radio"
                    name="action-status"
                    className="sr-only"
                    checked={status === s.value}
                    onChange={() => setStatus(s.value)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
          {onAddPrerequisite && onRemovePrerequisite && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <span className="text-sm font-medium text-foreground">Blocked by</span>
              {blockers && blockers.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {blockers.map((blocker) => (
                    <li key={blocker.id} className="flex items-center gap-2 text-sm">
                      <span className={cn('flex-1 truncate', blocker.done && 'text-muted-foreground line-through')}>
                        {blocker.title}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove prerequisite ${blocker.title}`}
                        onClick={() => onRemovePrerequisite(blocker.id)}
                        className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No prerequisites.</p>
              )}
              {blockerCandidates && blockerCandidates.length > 0 && (
                <select
                  aria-label="Add prerequisite"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onAddPrerequisite(e.target.value);
                  }}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
                >
                  <option value="" disabled>
                    Add a prerequisite…
                  </option>
                  {blockerCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              )}
              {wouldUnblock && wouldUnblock.length > 0 && (
                <p className="text-xs text-muted-foreground">Would unblock: {wouldUnblock.join(', ')}</p>
              )}
            </div>
          )}
          {(onMakeProject || (moveTargets && onMove)) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {onMakeProject && (
                <Button type="button" variant="outline" size="sm" onClick={onMakeProject}>
                  Make project
                </Button>
              )}
              {moveTargets && onMove && (
                <select
                  aria-label="Move to"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onMove(e.target.value);
                  }}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
                >
                  <option value="" disabled>
                    Move to…
                  </option>
                  {moveTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
