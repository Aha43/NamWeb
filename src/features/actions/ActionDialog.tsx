import { useState, type FormEvent, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TagsInput } from './TagsInput';
import { InheritedTags } from './InheritedTags';
import { ResourcesEditor } from './ResourcesEditor';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { parseFlexibleDate } from '@/lib/dates';
import type { NamNode, NodeStatus, Resource } from '@/domain/types';

/** The edited fields the dialog produces on save. Tags are raw (un-normalized). */
export interface ActionEdits {
  title: string;
  description: string | null;
  tags: string[];
  dueAt: string | null;
  status: NodeStatus;
  resources: Resource[];
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
  onDelete,
  deleteConfirmMessage,
  availableTags = [],
  inheritedTags = [],
}: {
  node: NamNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (edits: ActionEdits) => void;
  /** Existing tags to suggest in the tag field (registered + in-use). */
  availableTags?: string[];
  /** Tags inherited from ancestor projects ("rub-off") — shown read-only, can't be edited here. */
  inheritedTags?: string[];
  onMakeProject?: () => void;
  moveTargets?: MoveTarget[];
  onMove?: (targetId: string) => void;
  blockers?: Blocker[];
  blockerCandidates?: MoveTarget[];
  wouldUnblock?: string[];
  onAddPrerequisite?: (prereqId: string) => void;
  onRemovePrerequisite?: (prereqId: string) => void;
  /** Delete this node (the dialog confirms inline; the provider chooses leaf vs recursive). */
  onDelete?: () => void;
  /** Count-aware confirm message shown in the inline delete confirm. */
  deleteConfirmMessage?: string;
}) {
  const isProject = node.project;
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description ?? '');
  const [tags, setTags] = useState(node.tags.join(', '));
  const [due, setDue] = useState(node.dueAt ?? '');
  const [dueError, setDueError] = useState(false);
  const [status, setStatus] = useState<NodeStatus>(node.status);
  const [resources, setResources] = useState<Resource[]>(node.resources);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
      resources,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
            <DialogTitle>{isProject ? 'Edit project' : 'Edit action'}</DialogTitle>
            <DialogDescription>Update the title, notes, tags, due date, and status.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 px-6 py-4">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="action-tags">Tags</Label>
              <TagsInput id="action-tags" value={tags} onChange={setTags} suggestions={availableTags} />
              <InheritedTags tags={inheritedTags} />
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
          <CollapsibleSection title="Resources" defaultOpen={node.resources.length > 0}>
            <ResourcesEditor resources={resources} onChange={setResources} />
          </CollapsibleSection>
          {onAddPrerequisite && onRemovePrerequisite && (
            <CollapsibleSection title="Blocked by" defaultOpen={(blockers?.length ?? 0) > 0}>
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
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
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
            </CollapsibleSection>
          )}
          {(onMakeProject || (moveTargets && onMove)) && (
            <CollapsibleSection title="Move / make project">
              <div className="flex flex-wrap items-center gap-2">
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
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
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
            </CollapsibleSection>
          )}
          </DialogBody>
          <DialogFooter className="border-t border-border px-6 py-4">
            {confirmingDelete ? (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-sm text-destructive sm:mr-auto">
                  {deleteConfirmMessage ?? 'Delete this? This cannot be undone.'}
                </span>
                <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" autoFocus onClick={() => onDelete?.()}>
                  Delete
                </Button>
              </div>
            ) : (
              <>
                {onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmingDelete(true)}
                    className="text-destructive hover:text-destructive sm:mr-auto"
                  >
                    Delete
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A disclosure for an occasional section (Resources, Blocked by, Move / make project) so the
 *  open dialog stays short — title/notes/tags/due/status — and Save/Cancel never get pushed off
 *  screen. Opens by default when the section already has content worth seeing. */
function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 text-sm font-medium text-foreground"
      >
        <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-90')} />
        {title}
      </button>
      {open && <div className="space-y-1.5 pt-2">{children}</div>}
    </div>
  );
}

