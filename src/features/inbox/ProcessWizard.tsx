import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ProjectPickerColumns } from '@/features/projects/picker/ProjectPickerColumns';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { cn } from '@/lib/utils';
import type { ProcessResolution, ProjectTarget } from './InboxProcessDialog';

/**
 * The staged bulk-processing wizard (#635, shared with the inbox since #641): destination step →
 * status step → Done. The destination step embeds the Finder-style {@link ProjectPickerColumns}
 * on desktop (a native select on phone; `''` = the default location — Free actions / Top level);
 * the status step offers Next / Backlog / Make projects as a *selection*, and **Done** commits by
 * calling `onResolve`. Back/Cancel navigate without committing.
 *
 * Hosts mount it fresh per run (`{open && <ProcessWizard …/>}`) — step/choice state initializes at
 * mount — and unmount it from `onResolve`/`onCancel`. `initialTargetId` lets a host persist the
 * last-used destination across runs.
 */
export function ProcessWizard({
  count,
  projectTargets,
  initialTargetId = '',
  onCreateProject,
  onResolve,
  onCancel,
}: {
  /** How many items the resolution will apply to (the summary line). */
  count: number;
  projectTargets: ProjectTarget[];
  /** Preselected destination ('' = default location). */
  initialTargetId?: string;
  onCreateProject?: (parentId: string | null, title: string) => string;
  /** Done: commit the chosen kind/status at the chosen destination. */
  onResolve: (resolution: ProcessResolution) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const [step, setStep] = useState<'destination' | 'status'>('destination');
  const [target, setTarget] = useState(initialTargetId);
  const [choice, setChoice] = useState<'NEXT' | 'BACKLOG' | 'PROJECT' | null>(null);
  // The embedded columns' current confirmable destination (desktop; phone's select always is).
  const [confirmable, setConfirmable] = useState<string | null>(null);

  const targetLabel = target
    ? (projectTargets.find((pt) => pt.id === target)?.label ?? t('inbox.fallbackProject'))
    : t('inbox.freeActionsTarget');

  const finish = () => {
    if (choice === null) return;
    const parentId = target || undefined;
    onResolve(
      choice === 'PROJECT' ? { kind: 'project', parentId } : { kind: 'action', status: choice, parentId },
    );
  };

  if (step === 'destination') {
    return (
      <div className="flex min-h-0 flex-col rounded-md border border-border">
        <p className="border-b border-border px-3 py-2 text-sm font-medium">{t('inbox.fileUnderTitle')}</p>
        {isDesktop ? (
          // Mounted fresh per wizard entry, so its navigation initializes then (the #607 class).
          <ProjectPickerColumns
            targets={[{ id: '', label: t('inbox.defaultTarget') }, ...projectTargets]}
            initialSelectedId={target}
            onSelectionChange={setConfirmable}
            onPick={(id) => {
              setTarget(id);
              setStep('status');
            }}
            onCreateProject={onCreateProject}
            columnsClassName="h-56"
          />
        ) : (
          <label className="flex flex-col gap-1 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t('inbox.fileUnder')}</span>
            <select
              aria-label={t('inbox.fileUnder')}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
            >
              <option value="">{t('inbox.defaultTarget')}</option>
              {projectTargets.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2 border-t border-border px-3 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isDesktop && confirmable === null}
            onClick={() => {
              if (isDesktop && confirmable !== null) setTarget(confirmable);
              setStep('status');
            }}
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium">{t('capture.statusStepTitle')}</p>
      <p className="truncate text-xs text-muted-foreground">
        {t('actions.selectedCount', { count })} → {targetLabel}
      </p>
      <div className="flex flex-col gap-1.5" role="group" aria-label={t('capture.statusStepTitle')}>
        {(
          [
            ['NEXT', t('domain.status.next')],
            ['BACKLOG', t('domain.status.backlog')],
            ['PROJECT', t('inbox.makeProjects')],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={choice === value}
            onClick={() => setChoice(value)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-left text-sm transition-colors',
              choice === value
                ? 'border-primary bg-accent font-medium text-foreground'
                : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setStep('destination')}>
          {t('common.back')}
        </Button>
        <Button type="button" size="sm" disabled={choice === null} onClick={finish}>
          {t('common.done')}
        </Button>
      </div>
    </div>
  );
}
