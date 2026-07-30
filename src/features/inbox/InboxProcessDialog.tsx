import { useEffect, useState } from 'react';
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
import type { NamNode } from '@/domain/types';

/** A project the clarified item can be filed under. */
export interface ProjectTarget {
  id: string;
  label: string;
}

/** The outcome of processing an inbox item. `parentId` files it under a project; omit for the default location. */
export type ProcessResolution =
  | { kind: 'project'; parentId?: string; tags?: string[] }
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
  const isDesktop = useIsDesktop();
  const deck = Boolean(onSkip); // process-all flow: parent swaps in the next item
  const parentId = targetId || undefined;

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
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (pickerOpen) return; // the project picker (a layer on top) owns the keys while it's open
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
        return;
      e.preventDefault();
      if (e.key === 'ArrowRight') onSkip?.();
      else onPrev?.();
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [deck, open, pickerOpen, onSkip, onPrev]);

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
          <DialogTitle>{deck ? t('inbox.processDeckTitle') : t('inbox.processItemTitle')}</DialogTitle>
          <DialogDescription className="truncate">
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
            <Button className="justify-start" onClick={() => resolve({ kind: 'project', parentId })}>
              {t('inbox.makeProject')}
            </Button>
            <Button variant="ghost" className="justify-start" onClick={back}>
              ← {t('common.back')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
