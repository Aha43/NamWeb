import { useContext, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { ChevronRight, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { STATUS_OPTIONS } from './status';
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
import { LinkToHereButton } from './LinkToHereButton';
import { ActionEditorContext } from './action-editor-context';
import { makeActionLink, parseActionLink } from '@/domain/actionLinks';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip } from '@/components/ui/tooltip';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';
import { cn } from '@/lib/utils';

// Mac shows ⌘; everyone else Ctrl. Best-effort platform sniff for the shortcut hint.
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform);
import { parseFlexibleDate, parseFlexibleTime } from '@/lib/dates';
import { DatePickerPopover } from '@/components/ui/date-picker';
import { CollapsedDue } from './CollapsedDue';
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
  /** Optional time of day for the range end (`"HH:MM"`, local); null = none. Emitted only with dueEndAt. */
  dueEndTime?: string | null;
  status: NodeStatus;
  resources: Resource[];
}

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
  linkBackRef,
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
  /** Registered while mounted: inserts a link to `targetId` into the buffered resources — the
   *  provider routes a link-back here when THIS node's editor is the toast's target (#663). */
  linkBackRef?: RefObject<((targetId: string) => void) | null>;
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
  const { t } = useTranslation();
  // Optional — presentational hosts/tests render without the provider; follow-link no-ops there.
  const editor = useContext(ActionEditorContext);
  const saveHint = IS_MAC ? t('editor.saveHintMac') : t('editor.saveHintOther');
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
  const [dueEndTime, setDueEndTime] = useState(node.dueEndTime ?? '');
  const [dueEndTimeError, setDueEndTimeError] = useState(false);
  const [status, setStatus] = useState<NodeStatus>(node.status);
  const [resources, setResources] = useState<Resource[]>(node.resources);
  // Register the buffer-inserter for provider-routed link-backs (#663). Dedupe-guarded, like
  // LinkToHereButton's onLinkBack below.
  useEffect(() => {
    if (!linkBackRef) return;
    linkBackRef.current = (targetId) =>
      setResources((rs) => (rs.some((r) => parseActionLink(r) === targetId) ? rs : [...rs, makeActionLink(targetId)]));
    return () => {
      linkBackRef.current = null;
    };
  }, [linkBackRef]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  // The scheduling extras (start time-of-day, end date, end time) collapse by default to keep the
  // common case — just a due date — tidy; open when the action already carries any of that data (#559).
  const [showDueExtras, setShowDueExtras] = useState(
    Boolean(node.dueTime || node.dueEndAt || node.dueEndTime),
  );
  const isDesktop = useIsDesktop();

  function doSave(): boolean {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return false;
    const dueAt = parseFlexibleDate(due);
    if (due.trim() && dueAt === null) {
      setDueError(true);
      return false;
    }
    // Optional end date: must parse, and be a real range (needs a start, and end ≥ start).
    const dueEndAt = dueEnd.trim() ? parseFlexibleDate(dueEnd) : null;
    if (dueEnd.trim() && (dueEndAt === null || !dueAt || dueEndAt < dueAt)) {
      setDueEndError(true);
      return false;
    }
    // Optional time of day on the start: must parse when entered (and only kept with a date).
    const dueTimeValue = dueTime.trim() ? parseFlexibleTime(dueTime) : null;
    if (dueTime.trim() && dueTimeValue === null) {
      setDueTimeError(true);
      return false;
    }
    // Optional time of day on the end: must parse when entered (and only kept with an end date).
    const dueEndTimeValue = dueEndTime.trim() ? parseFlexibleTime(dueEndTime) : null;
    if (dueEndTime.trim() && dueEndTimeValue === null) {
      setDueEndTimeError(true);
      return false;
    }
    // On a same-day range, the end time can't be before the start time (#508). HH:MM strings compare
    // chronologically. (Different days are already ordered by the date check above.)
    if (dueAt && dueEndAt && dueAt === dueEndAt && dueTimeValue && dueEndTimeValue && dueEndTimeValue < dueTimeValue) {
      setDueEndTimeError(true);
      return false;
    }
    const trimmedDescription = description.trim();
    const endAt = dueAt ? dueEndAt : null;
    onSave({
      title: trimmedTitle,
      description: trimmedDescription ? trimmedDescription : null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      dueAt,
      dueEndAt: endAt,
      dueTime: dueAt ? dueTimeValue : null,
      dueEndTime: endAt ? dueEndTimeValue : null,
      status,
      resources,
    });
    onOpenChange(false);
    return true;
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
  // Suspended while the nested Move-to picker is open — the topmost modal owns the shortcut,
  // otherwise one ⌘Enter confirms the move AND saves/closes this editor (#574).
  const saveRef = useRef(doSave);
  saveRef.current = doSave;
  useEffect(() => {
    if (!open || movePickerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        saveRef.current();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, movePickerOpen]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col gap-0 overflow-hidden p-0"
        // Clicking a toast (the link-back offer, #659) is an "interact outside" — don't let it
        // close the editor mid-edit. Toast rows render as role="status" (same as CaptureSheet).
        onInteractOutside={(event) => {
          const target = event.detail.originalEvent.target;
          if (target instanceof Element && target.closest('[role="status"]')) event.preventDefault();
        }}
      >
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
            <DialogTitle>{isProject ? t('editor.editProject') : t('editor.editAction')}</DialogTitle>
            <DialogDescription>{t('editor.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 px-6 py-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="action-title">{t('editor.fieldTitle')}</Label>
              <CopyButton value={title} label={t('copy.title')} tooltip />
            </div>
            <Input id="action-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="action-description">{t('editor.fieldDescription')}</Label>
              <CopyButton value={description} label={t('copy.description')} tooltip />
            </div>
            <Textarea
              id="action-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="action-tags">{t('editor.fieldTags')}</Label>
              <TagsInput id="action-tags" value={tags} onChange={setTags} suggestions={availableTags} />
              <InheritedTags tags={inheritedTags} />
            </div>
            {/* Dense until asked for (#721) — the collapsed line reads the live drafts, so
                buffered (not-yet-saved) edits show correctly after a re-collapse. */}
            <CollapsedDue
              fields={{
                dueAt: parseFlexibleDate(due),
                dueEndAt: parseFlexibleDate(dueEnd),
                dueTime: parseFlexibleTime(dueTime),
                dueEndTime: parseFlexibleTime(dueEndTime),
              }}
            >
            {(collapseDue) => (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="action-due">{t('editor.fieldDue')}</Label>
                <span className="flex items-center gap-2">
                  {(due || dueEnd || dueTime || dueEndTime) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDue('');
                        setDueEnd('');
                        setDueTime('');
                        setDueEndTime('');
                        setDueError(false);
                        setDueEndError(false);
                        setDueTimeError(false);
                        setDueEndTimeError(false);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t('common.clear')}
                    </button>
                  )}
                  <Tooltip label={t('editor.collapseDue')}>
                    <button
                      type="button"
                      aria-label={t('editor.collapseDue')}
                      onClick={collapseDue}
                      className="rounded-md text-muted-foreground hover:text-foreground"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </span>
              </div>
              {/* Type-in stays primary; the calendar button is an optional way to see weekdays (#499). */}
              <div className="flex gap-1.5">
                <Input
                  id="action-due"
                  className="min-w-0 flex-1"
                  placeholder={t('editor.duePlaceholder')}
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
                  label={t('editor.pickDueDate')}
                />
              </div>
              {/* Time-of-day + a date range are optional precision — tucked away until asked for (#559). */}
              {!showDueExtras && (
                <button
                  type="button"
                  onClick={() => setShowDueExtras(true)}
                  className="self-start text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('editor.addDueExtras')}
                </button>
              )}
              {showDueExtras && (
                <>
              {/* Optional time of day on the start — type the hour, optionally the minutes (#493). */}
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-xs text-muted-foreground">{t('editor.at')}</span>
                <Input
                  id="action-due-time"
                  aria-label={t('editor.dueTimeAria')}
                  placeholder={t('editor.dueTimePlaceholder')}
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
                <span className="shrink-0 text-xs text-muted-foreground">{t('editor.to')}</span>
                <Input
                  id="action-due-end"
                  aria-label={t('editor.dueEndAria')}
                  placeholder={t('editor.dueEndPlaceholder')}
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
                  label={t('editor.pickEndDate')}
                />
              </div>
              {/* Optional time of day on the end (#500). */}
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-xs text-muted-foreground">{t('editor.at')}</span>
                <Input
                  id="action-due-end-time"
                  aria-label={t('editor.dueEndTimeAria')}
                  placeholder={t('editor.dueEndTimePlaceholder')}
                  className="min-w-0 flex-1"
                  value={dueEndTime}
                  aria-invalid={dueEndTimeError}
                  onChange={(e) => {
                    setDueEndTime(e.target.value);
                    if (dueEndTimeError) setDueEndTimeError(false);
                  }}
                  onBlur={() => {
                    const hhmm = parseFlexibleTime(dueEndTime);
                    if (hhmm) setDueEndTime(hhmm);
                  }}
                />
              </div>
                </>
              )}
              {dueError && (
                <p role="alert" className="text-xs text-destructive">
                  {t('editor.dueError')}
                </p>
              )}
              {dueEndError && (
                <p role="alert" className="text-xs text-destructive">
                  {t('editor.dueEndError')}
                </p>
              )}
              {(dueTimeError || dueEndTimeError) && (
                <p role="alert" className="text-xs text-destructive">
                  {t('editor.dueTimeError')}
                </p>
              )}
            </div>
            )}
            </CollapsedDue>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">{t('editor.statusLegend')}</legend>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
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
                  {t(s.label)}
                </label>
              ))}
            </div>
          </fieldset>
          <CollapsibleSection title={t('editor.resources')} defaultOpen={node.resources.length > 0}>
            <ResourcesEditor
              resources={resources}
              onChange={setResources}
              linkExcludeId={node.id}
              // Following a link remounts this dialog onto the target — save first so buffered
              // edits (title, notes, fresh links) aren't silently discarded (#663).
              onFollowLink={(targetId) => {
                if (doSave()) editor?.openEditor(targetId);
              }}
            />
            <LinkToHereButton
              nodeId={node.id}
              onLinkBack={(pickedId) =>
                setResources((rs) =>
                  rs.some((r) => parseActionLink(r) === pickedId) ? rs : [...rs, makeActionLink(pickedId)],
                )
              }
            />
          </CollapsibleSection>
          {onAddPrerequisite && onRemovePrerequisite && (
            <CollapsibleSection title={t('editor.blockedBy')} defaultOpen={(blockers?.length ?? 0) > 0}>
              {blockers && blockers.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {blockers.map((blocker) => (
                    <li key={blocker.id} className="flex items-center gap-2 text-sm">
                      <span className={cn('flex-1 truncate', blocker.done && 'text-muted-foreground line-through')}>
                        {blocker.title}
                      </span>
                      <button
                        type="button"
                        aria-label={t('editor.removePrereqAria', { title: blocker.title })}
                        onClick={() => onRemovePrerequisite(blocker.id)}
                        className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{t('editor.noPrereqs')}</p>
              )}
              {blockerCandidates && blockerCandidates.length > 0 && (
                <select
                  aria-label={t('editor.addPrereqAria')}
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onAddPrerequisite(e.target.value);
                  }}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
                >
                  <option value="" disabled>
                    {t('editor.addPrereqOption')}
                  </option>
                  {blockerCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              )}
              {wouldUnblock && wouldUnblock.length > 0 && (
                <p className="text-xs text-muted-foreground">{t('editor.wouldUnblock', { list: wouldUnblock.join(', ') })}</p>
              )}
            </CollapsibleSection>
          )}
          {(onMakeProject || (moveTargets && onMove)) && (
            <CollapsibleSection title={t('editor.moveSection')}>
              <div className="flex flex-wrap items-center gap-2">
                {onMakeProject && (
                  <Button type="button" variant="outline" size="sm" onClick={onMakeProject}>
                    {t('inbox.makeProject')}
                  </Button>
                )}
                {moveTargets && onMove && (
                  // Desktop gets the Finder-style column picker; phone keeps the lightweight native
                  // select (the picker's columns are fiddly on a small screen).
                  isDesktop ? (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={() => setMovePickerOpen(true)}>
                        {t('editor.moveTo')}
                      </Button>
                      <ProjectPickerDialog
                        open={movePickerOpen}
                        onOpenChange={setMovePickerOpen}
                        title={t('editor.moveTitle', { title: node.title })}
                        targets={moveTargets}
                        onConfirm={onMove}
                        onCreateProject={onCreateProject}
                      />
                    </>
                  ) : (
                    <select
                      aria-label={t('editor.moveToAria')}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) onMove(e.target.value);
                      }}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
                    >
                      <option value="" disabled>
                        {t('editor.moveTo')}
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
                  {deleteConfirmMessage ?? t('editor.deleteConfirmDefault')}
                </span>
                <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="button" variant="destructive" autoFocus onClick={() => onDelete?.()}>
                  {t('common.delete')}
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
                    {t('common.delete')}
                  </Button>
                )}
                <Tooltip label={t('editor.cancelHint')}>
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    {t('common.cancel')}
                  </Button>
                </Tooltip>
                <Tooltip label={saveHint}>
                  <Button type="submit">{t('common.save')}</Button>
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

