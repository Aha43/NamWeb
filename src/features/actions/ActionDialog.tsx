import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
import { CopyButton } from '@/components/ui/copy-button';
import { ResourcesEditor } from './ResourcesEditor';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip } from '@/components/ui/tooltip';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';
import { cn } from '@/lib/utils';

// Mac shows ⌘; everyone else Ctrl. Best-effort platform sniff for the shortcut hints.
const SAVE_HINT =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform)
    ? 'Save (⌘ + Enter)'
    : 'Save (Ctrl + Enter)';
import { parseFlexibleDate, parseFlexibleTime } from '@/lib/dates';
import { DatePickerPopover } from '@/components/ui/date-picker';
import type { NamNode, NodeStatus, Resource } from '@/domain/types';

/** The edited fields the dialog produces on save. Tags are raw (un-normalized). */
export interface ActionEdits {
  title: string;
  description: string | null;
  tags: string[];
  dueAt: string | null;
  /** Optional end of a date range (inclusive); null = single date. Editor only emits it ≥ dueAt. */
  dueEndAt?: string | null;
  /** Optional time of day for the start (`"HH:MM"`, local); null = none. Emitted only with a dueAt. */
  dueTime?: string | null;
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
  onCreateProject,
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
  /** Create a project under `parentId` (null = top level) and return its id — powers the picker's
   *  "New project here". */
  onCreateProject?: (parentId: string | null, title: string) => string;
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
  const [dueEnd, setDueEnd] = useState(node.dueEndAt ?? '');
  const [dueEndError, setDueEndError] = useState(false);
  const [dueTime, setDueTime] = useState(node.dueTime ?? '');
  const [dueTimeError, setDueTimeError] = useState(false);
  const [status, setStatus] = useState<NodeStatus>(node.status);
  const [resources, setResources] = useState<Resource[]>(node.resources);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const isDesktop = useIsDesktop();

  function doSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const dueAt = parseFlexibleDate(due);
    if (due.trim() && dueAt === null) {
      setDueError(true);
      return;
    }
    // Optional end date: must parse, and be a real range (needs a start, and end ≥ start).
    const dueEndAt = dueEnd.trim() ? parseFlexibleDate(dueEnd) : null;
    if (dueEnd.trim() && (dueEndAt === null || !dueAt || dueEndAt < dueAt)) {
      setDueEndError(true);
      return;
    }
    // Optional time of day on the start: must parse when entered (and only kept with a date).
    const dueTimeValue = dueTime.trim() ? parseFlexibleTime(dueTime) : null;
    if (dueTime.trim() && dueTimeValue === null) {
      setDueTimeError(true);
      return;
    }
    const trimmedDescription = description.trim();
    onSave({
      title: trimmedTitle,
      description: trimmedDescription ? trimmedDescription : null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      dueAt,
      dueEndAt: dueAt ? dueEndAt : null,
      dueTime: dueAt ? dueTimeValue : null,
      status,
      resources,
    });
    onOpenChange(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    doSave();
  }

  // ⌘/Ctrl+Enter saves from anywhere in the dialog. A document-level listener (while open) instead
  // of a form `onKeyDown` so it fires even when focus sits in a *portaled* Radix control — the Tags
  // suggestion popover, the Move-to picker, a date popover — whose DOM lives outside the form and so
  // never bubbles keydown to it (the #435 intermittent miss). A ref keeps the latest save closure
  // without re-subscribing on every keystroke; IME composition is left to compose.
  const saveRef = useRef(doSave);
  saveRef.current = doSave;
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        saveRef.current();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

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
            <div className="flex items-center justify-between">
              <Label htmlFor="action-title">Title</Label>
              <CopyButton value={title} label="title" />
            </div>
            <Input id="action-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="action-description">Description</Label>
              <CopyButton value={description} label="description" />
            </div>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="action-due">Due</Label>
                {(due || dueEnd || dueTime) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDue('');
                      setDueEnd('');
                      setDueTime('');
                      setDueError(false);
                      setDueEndError(false);
                      setDueTimeError(false);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              {/* Type-in stays primary; the calendar button is an optional way to see weekdays (#499). */}
              <div className="flex gap-1.5">
                <Input
                  id="action-due"
                  className="min-w-0 flex-1"
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
                <DatePickerPopover
                  value={parseFlexibleDate(due)}
                  onSelect={(isoDate) => { setDue(isoDate); setDueError(false); }}
                  label="Pick a due date from a calendar"
                />
              </div>
              {/* Optional time of day on the start — type the hour, optionally the minutes (#493). */}
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-xs text-muted-foreground">at</span>
                <Input
                  id="action-due-time"
                  aria-label="Due time (optional)"
                  placeholder="14:30 (optional)"
                  className="min-w-0 flex-1"
                  value={dueTime}
                  aria-invalid={dueTimeError}
                  onChange={(e) => {
                    setDueTime(e.target.value);
                    if (dueTimeError) setDueTimeError(false);
                  }}
                  onBlur={() => {
                    // Echo canonical HH:MM (14 → 14:00, 1430 → 14:30) to confirm what was parsed.
                    const hhmm = parseFlexibleTime(dueTime);
                    if (hhmm) setDueTime(hhmm);
                  }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-xs text-muted-foreground">to</span>
                <Input
                  id="action-due-end"
                  aria-label="Due end (optional)"
                  placeholder="end (optional)"
                  className="min-w-0 flex-1"
                  value={dueEnd}
                  aria-invalid={dueEndError}
                  onChange={(e) => {
                    setDueEnd(e.target.value);
                    if (dueEndError) setDueEndError(false);
                  }}
                  onBlur={() => {
                    const iso = parseFlexibleDate(dueEnd);
                    if (iso) setDueEnd(iso);
                  }}
                />
                <DatePickerPopover
                  value={parseFlexibleDate(dueEnd)}
                  onSelect={(isoDate) => { setDueEnd(isoDate); setDueEndError(false); }}
                  label="Pick an end date from a calendar"
                />
              </div>
              {dueError && (
                <p role="alert" className="text-xs text-destructive">
                  Use a date like 26-7-4 or 2026-07-04.
                </p>
              )}
              {dueEndError && (
                <p role="alert" className="text-xs text-destructive">
                  The end needs a start date and must be on or after it.
                </p>
              )}
              {dueTimeError && (
                <p role="alert" className="text-xs text-destructive">
                  Use a time like 14:30 or 9 (24-hour).
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
                  // Desktop gets the Finder-style column picker; phone keeps the lightweight native
                  // select (the picker's columns are fiddly on a small screen).
                  isDesktop ? (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={() => setMovePickerOpen(true)}>
                        Move to…
                      </Button>
                      <ProjectPickerDialog
                        open={movePickerOpen}
                        onOpenChange={setMovePickerOpen}
                        title={`Move "${node.title}" to…`}
                        targets={moveTargets}
                        onConfirm={onMove}
                        onCreateProject={onCreateProject}
                      />
                    </>
                  ) : (
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
                  )
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
                    // Projects open the advanced-delete dialog (it confirms); actions confirm inline here.
                    onClick={() => (isProject ? onDelete() : setConfirmingDelete(true))}
                    className="text-destructive hover:text-destructive sm:mr-auto"
                  >
                    Delete
                  </Button>
                )}
                <Tooltip label="Cancel (Esc)">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                </Tooltip>
                <Tooltip label={SAVE_HINT}>
                  <Button type="submit">Save</Button>
                </Tooltip>
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

