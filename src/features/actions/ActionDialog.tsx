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
export function ActionDialog({
  node,
  open,
  onOpenChange,
  onSave,
}: {
  node: NamNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (edits: ActionEdits) => void;
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
