import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';
import type { NamNode } from '@/domain/types';

/** A project the clarified item can be filed under. */
export interface ProjectTarget {
  id: string;
  label: string;
}

/** The outcome of processing an inbox item. `parentId` files it under a project; omit for the default location. */
export type ProcessResolution =
  | { kind: 'project'; parentId?: string }
  | { kind: 'action'; status: 'NEXT' | 'BACKLOG'; parentId?: string };

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
  onCreateProject,
  onDelete,
  onSkip,
  remaining,
}: {
  node: NamNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (resolution: ProcessResolution) => void;
  /** Existing projects the item can be filed/nested under (breadcrumb-labeled). */
  projectTargets?: ProjectTarget[];
  /** Create a project under `parentId` (null = top level) and return its id — powers the picker's
   *  "New project here". */
  onCreateProject?: (parentId: string | null, title: string) => string;
  /** Deck mode (process-all): delete the current item and advance. */
  onDelete?: () => void;
  /** Deck mode: leave the item in the inbox and advance to the next. */
  onSkip?: () => void;
  /** Deck mode: how many items are left (incl. the current one). */
  remaining?: number;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'kind' | 'action' | 'project'>('kind');
  // '' = the default location (Free actions for an action, Top level for a project).
  const [targetId, setTargetId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const deck = Boolean(onSkip); // process-all flow: parent swaps in the next item
  const parentId = targetId || undefined;

  function resolve(resolution: ProcessResolution) {
    onResolve(resolution);
    if (!deck) onOpenChange(false);
  }

  function back() {
    setTargetId('');
    setStep('kind');
  }

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
            {deck && remaining ? ` · ${t('inbox.remainingLeft', { count: remaining })}` : ''}
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
              <div className="mt-1 flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 text-destructive" onClick={onDelete}>
                  {t('common.delete')}
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={onSkip}>
                  {t('inbox.skip')} →
                </Button>
              </div>
            )}
          </div>
        ) : step === 'action' ? (
          <div className="flex flex-col gap-2">
            {picker(t('inbox.freeActionsLabel'), t('inbox.fileUnder'))}
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
