import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { TagsInput } from '@/features/actions/TagsInput';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';
import { ConvertToProjectDialog } from '@/features/actions/ConvertToProjectDialog';
import type { NamNode } from '@/domain/types';

/** A project the clarified item can be filed under. */
export interface ProjectTarget {
  id: string;
  label: string;
}

/** The outcome of processing an inbox item. `parentId` files it under a project; omit for the default
 *  location. A `project` may carry a renamed title, seeded first-action names, and whether to open the
 *  new project or keep processing the inbox (#1007). */
export type ProcessResolution =
  | { kind: 'project'; parentId?: string; tags?: string[]; projectTitle?: string; actionNames?: string[]; openAfter?: boolean }
  | { kind: 'action'; status: 'NEXT' | 'BACKLOG'; parentId?: string; tags?: string[] };

/**
 * Clarify an inbox item: is it one action or does it need planning (a project)?
 * If an action, do it next or park it for later. Either way, optionally file it
 * under an existing project. Mirrors NamDesktop's ProcessInboxDialog.
 * Presentational — reports the choice via `onResolve`.
 */
export function InboxProcessDialog({
  node,
  open,
  onOpenChange,
  onResolve,
  projectTargets = [],
  availableTags = [],
  onCreateProject,
  onDelete,
  onSkip,
  onPrev,
  onCapture,
  remaining,
  position,
}: {
  node: NamNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (resolution: ProcessResolution) => void;
  /** Existing projects the item can be filed/nested under (breadcrumb-labeled). */
  projectTargets?: ProjectTarget[];
  /** Tag suggestions for the clarify-time tag field (#920). */
  availableTags?: string[];
  /** Create a project under `parentId` (null = top level) and return its id — powers the picker's
   *  "New project here". */
  onCreateProject?: (parentId: string | null, title: string) => string;
  /** Deck mode (process-all): delete the current item and advance. */
  onDelete?: () => void;
  /** Deck mode: leave the item in the inbox and advance to the next (→ / ArrowRight). */
  onSkip?: () => void;
  /** Deck mode: step back to the previous item (← / ArrowLeft). */
  onPrev?: () => void;
  /** Deck mode: capture a just-remembered thought straight to the inbox without leaving the deck
   *  (#1119). Lands in the inbox (not the current queue), so the batch you're triaging is undisturbed;
   *  press `c` to jump to the field (the global capture shortcut is suppressed while this modal is open). */
  onCapture?: (title: string) => void;
  /** Deck mode: how many items are left (incl. the current one). */
  remaining?: number;
  /** Deck mode: 1-based position of the current item within the remaining set (for "X of N"). */
  position?: number;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'kind' | 'action' | 'project'>('kind');
  // '' = the default location (Free actions for an action, Top level for a project).
  const [targetId, setTargetId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  // Tags to apply while clarifying (#920) — a comma-separated string (TagsInput's shape), split at
  // resolve time; additive, so the classification lands with the convert.
  const [tags, setTags] = useState('');
  // The make-project brain-dump (#1007) — seed first actions the moment you decide it's a project.
  const [convertOpen, setConvertOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const deck = Boolean(onSkip); // process-all flow: parent swaps in the next item
  const parentId = targetId || undefined;
  // Quick-capture within the deck (#1119): jot a just-remembered thought to the inbox and keep going.
  const [captureValue, setCaptureValue] = useState('');
  const [justCaptured, setJustCaptured] = useState(false);
  const captureRef = useRef<HTMLInputElement>(null);

  function submitCapture(e: FormEvent) {
    e.preventDefault();
    const title = captureValue.trim();
    if (!title || !onCapture) return;
    onCapture(title);
    setCaptureValue('');
    setJustCaptured(true);
    captureRef.current?.focus(); // stay put — add several in a row
  }

  function resolve(resolution: ProcessResolution) {
    const tagList = tags.split(',').map((s) => s.trim()).filter(Boolean);
    onResolve({ ...resolution, tags: tagList.length ? tagList : undefined });
    if (!deck) onOpenChange(false);
  }

  function back() {
    setTargetId('');
    setTags('');
    setStep('kind');
  }

  // Deck-only keyboard cycling (#866): ←/→ roll to the previous/next item so working the deck stays
  // on the keyboard. A WINDOW listener in the CAPTURE phase (#882, #885), not a DialogContent
  // onKeyDown — the latter only fires when focus is inside the dialog, and a bubble-phase window
  // listener still loses: something in the Radix dialog path consumes the arrow keydown, and the
  // browser's own focus navigation (Safari / macOS "Full Keyboard Access") moves focus to a button
  // before we ever see it. Capture runs FIRST, so our preventDefault wins — exactly how the Focus
  // deck does it. We can't reuse its isModalOpen() guard (this dialog IS the modal), so we bail when
  // the nested project picker owns the keys, or when the event is a typing target / a modifier combo.
  useEffect(() => {
    if (!deck || !open) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // A layer on top owns the keys: the project picker OR the make-project brain-dump (#1007) —
      // otherwise ←/→ would advance the inbox deck underneath the open dialog.
      if (pickerOpen || convertOpen) return;
      const el = e.target as HTMLElement | null;
      // Typing target (incl. the capture field itself) keeps the keys — so `c` types normally there.
      if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
        return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSkip?.();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev?.();
      } else if ((e.key === 'c' || e.key === 'C') && onCapture) {
        // Mirror the global quick-capture shortcut, which is suppressed while this modal is open (#1119).
        e.preventDefault();
        captureRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [deck, open, pickerOpen, convertOpen, onSkip, onPrev, onCapture]);

  const picker = (defaultLabel: string, fieldLabel: string) => {
    if (projectTargets.length === 0) return null;
    // Desktop: a button showing the current choice that opens the Finder-style column picker; it only
    // SETS the destination (the resolve buttons below still commit). Phone keeps the native select.
    if (isDesktop) {
      const current =
        targetId === '' ? defaultLabel : projectTargets.find((target) => target.id === targetId)?.label ?? defaultLabel;
      return (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{fieldLabel}</span>
          <Button
            type="button"
            variant="outline"
            aria-label={fieldLabel}
            className="justify-between font-normal"
            onClick={() => setPickerOpen(true)}
          >
            <span className="truncate">{current}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
          <ProjectPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            title={fieldLabel}
            confirmLabel={t('common.choose')}
            targets={[{ id: '', label: defaultLabel }, ...projectTargets]}
            initialSelectedId={targetId}
            onConfirm={setTargetId}
            onCreateProject={onCreateProject}
          />
        </div>
      );
    }
    return (
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{fieldLabel}</span>
        <select
          aria-label={fieldLabel}
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
        >
          <option value="">{defaultLabel}</option>
          {projectTargets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.label}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) back();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          {/* #1186 — the item you're clarifying is the hero. The static step name stays the dialog's
              accessible title but now reads as a quiet eyebrow; the item title (which used to sit here
              in the muted description, so the eye had to hunt for it) is promoted to the loud line.
              Item + deck position stay on one line to keep the "Title · N of N" cue. */}
          <DialogTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {deck ? t('inbox.processDeckTitle') : t('inbox.processItemTitle')}
          </DialogTitle>
          <DialogDescription className="text-xl font-semibold leading-snug text-foreground break-words">
            {node.title}
            {deck && remaining && position
              ? ` · ${t('inbox.deckPosition', { position, total: remaining })}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {step === 'kind' ? (
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start" onClick={() => setStep('action')}>
              {t('inbox.kindAction')}
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => setStep('project')}>
              {t('inbox.kindProject')}
            </Button>
            {deck && (
              // Navigate the deck like the Focus deck: ‹ prev · Delete · next › (#988). ←/→ mirror
              // the chevrons; both roll past the ends, and the "X of N" above shows the wrap (#866).
              <div className="mt-1 flex items-center justify-center gap-4">
                {remaining && remaining > 1 && (
                  <Button variant="outline" size="icon" aria-label={t('inbox.prevItem')} onClick={onPrev}>
                    <ChevronLeft />
                  </Button>
                )}
                {/* Delete in the inbox means two things — "nothing to do" OR "already handled" —
                    because an inbox item has no other terminal state yet. The tooltip names that (#988). */}
                <Tooltip label={t('inbox.deleteMeaning')}>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                    {t('common.delete')}
                  </Button>
                </Tooltip>
                {remaining && remaining > 1 && (
                  <Button variant="outline" size="icon" aria-label={t('inbox.nextItem')} onClick={onSkip}>
                    <ChevronRight />
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : step === 'action' ? (
          <div className="flex flex-col gap-2">
            {picker(t('inbox.freeActionsLabel'), t('inbox.fileUnder'))}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t('inbox.tagsLabel')}</span>
              <TagsInput id="process-tags" value={tags} onChange={setTags} suggestions={availableTags} />
            </label>
            <Button className="justify-start" onClick={() => resolve({ kind: 'action', status: 'NEXT', parentId })}>
              {t('inbox.doItNext')}
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => resolve({ kind: 'action', status: 'BACKLOG', parentId })}
            >
              {t('inbox.parkForLater')}
            </Button>
            <Button variant="ghost" className="justify-start" onClick={back}>
              ← {t('common.back')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {picker(t('inbox.topLevel'), t('inbox.nestUnder'))}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t('inbox.tagsLabel')}</span>
              <TagsInput id="process-tags" value={tags} onChange={setTags} suggestions={availableTags} />
            </label>
            <Button className="justify-start" onClick={() => setConvertOpen(true)}>
              {t('inbox.makeProject')}
            </Button>
            <Button variant="ghost" className="justify-start" onClick={back}>
              ← {t('common.back')}
            </Button>
          </div>
        )}

        {deck && onCapture && (
          // Quick-capture without breaking the deck (#1119): a thought that arrives mid-triage goes
          // straight to the inbox (press `c` to jump here) and you keep processing. Persistent across
          // steps so it's always a keystroke away; the new item lands in the inbox, not this queue.
          <form onSubmit={submitCapture} className="mt-1 flex items-center gap-2 border-t border-border pt-3">
            <input
              ref={captureRef}
              value={captureValue}
              onChange={(e) => {
                setCaptureValue(e.target.value);
                setJustCaptured(false);
              }}
              placeholder={t('inbox.captureAnotherPlaceholder')}
              aria-label={t('inbox.captureAnother')}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
            />
            <Button type="submit" size="sm" variant="outline" disabled={!captureValue.trim()}>
              {t('common.add')}
            </Button>
            {/* aria-live so the add is announced; fixed width so the row doesn't jump as it appears. */}
            <span className="min-w-14 text-xs text-muted-foreground" aria-live="polite">
              {justCaptured ? t('capture.justAdded') : ''}
            </span>
          </form>
        )}
      </DialogContent>
      {/* Making a project from this inbox item: seed its first actions in the moment (#1007). The
          two-button footer decides whether to open the new project or keep processing the inbox. */}
      {convertOpen && (
        <ConvertToProjectDialog
          open
          onOpenChange={(o) => {
            if (!o) setConvertOpen(false);
          }}
          actionTitle={node.title}
          createLabel={t('inbox.createOpenProject')}
          continueLabel={t('inbox.createKeepProcessing')}
          onConfirm={(projectTitle, actionNames, openAfter) => {
            setConvertOpen(false);
            resolve({ kind: 'project', parentId, projectTitle, actionNames, openAfter });
          }}
        />
      )}
    </Dialog>
  );
}
