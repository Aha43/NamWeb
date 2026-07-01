import { useState, type FormEvent } from 'react';
import { CheckSquare, Pencil, Target, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { AddPositionToggle } from '@/components/settings/AddPositionToggle';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TOUCH_TARGET } from '@/lib/touch';
import { formatAge } from '@/lib/dates';
import { InlineRename } from '../actions/InlineRename';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';
import type { ProcessResolution, ProjectTarget } from './InboxProcessDialog';
import type { NamNode } from '../../domain/types';

export interface InboxPanelProps {
  items: NamNode[];
  onAdd: (title: string) => void;
  onProcess: (id: string) => void;
  /** Start the one-at-a-time process-all deck. */
  onProcessAll?: () => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  /** Triage many selected items at once with one shared resolution (#458). */
  onBulkResolve?: (ids: string[], resolution: ProcessResolution) => void;
  /** Delete many selected items at once (single Undo). */
  onBulkDelete?: (ids: string[]) => void;
  /** Projects the bulk "File under" picker can target (breadcrumb-labeled). */
  projectTargets?: ProjectTarget[];
}

/** Inbox: quick-add capture plus the list of unprocessed items. Pure/presentational. */
export function InboxPanel({
  items,
  onAdd,
  onProcess,
  onProcessAll,
  onDelete,
  onRename,
  onBulkResolve,
  onBulkDelete,
  projectTargets = [],
}: InboxPanelProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Bulk select: triage several items with one shared decision (#458). Additive — per-item Process
  // and the Process-all deck are untouched.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState(''); // '' = default (Free actions / Top level)
  const [pickerOpen, setPickerOpen] = useState(false);
  const bulkCapable = Boolean(onBulkResolve);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
    setBulkTarget('');
  };
  const none = selected.size === 0;
  const parentId = bulkTarget || undefined;
  const resolveSelected = (resolution: ProcessResolution) => {
    onBulkResolve?.([...selected], resolution);
    setSelected(new Set());
  };
  const targetLabel = bulkTarget
    ? (projectTargets.find((pt) => pt.id === bulkTarget)?.label ?? t('inbox.fallbackProject'))
    : t('inbox.freeActionsTarget');

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }

  return (
    <section className="space-y-4">
      {/* Pin the add box + Process button so they stay reachable while the inbox list scrolls. */}
      <div className="sticky top-0 z-10 space-y-4 bg-background pt-1">
        <form onSubmit={submit} className="flex gap-2">
          <input
            aria-label={t('inbox.quickAddAria')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('inbox.addPlaceholder')}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
          />
          <AddPositionToggle />
          <Button type="submit">{t('common.add')}</Button>
        </form>

        {items.length > 0 && (
          <div className="flex items-center justify-end gap-1">
            {onProcessAll && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onProcessAll}>
                <Target className="h-4 w-4 focus-glow" />
                {t('inbox.processAll', { count: items.length })}
              </Button>
            )}
            {bulkCapable && (
              <Tooltip label={selectMode ? t('inbox.exitSelect') : t('inbox.selectItems')}>
                <button
                  type="button"
                  aria-label={selectMode ? t('inbox.exitSelect') : t('inbox.selectItems')}
                  aria-pressed={selectMode}
                  onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                  className={cn(
                    'rounded-md p-1.5 hover:bg-accent hover:text-foreground',
                    TOUCH_TARGET,
                    selectMode ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <CheckSquare className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {selectMode && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
            <span className="mr-1 text-muted-foreground">{t('actions.selectedCount', { count: selected.size })}</span>
            {/* Destination first: the verbs below file into whatever this is set to. */}
            <Tooltip label={t('inbox.fileIntoTooltip', { target: targetLabel })}>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="max-w-[14rem] truncate rounded-md border border-input px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {t('inbox.fileInto')} <span className="font-medium text-foreground">{targetLabel}</span> ▾
              </button>
            </Tooltip>
            <button
              type="button"
              disabled={none}
              onClick={() => resolveSelected({ kind: 'action', status: 'NEXT', parentId })}
              className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              → {t('domain.status.next')}
            </button>
            <button
              type="button"
              disabled={none}
              onClick={() => resolveSelected({ kind: 'action', status: 'BACKLOG', parentId })}
              className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              → {t('domain.status.backlog')}
            </button>
            <button
              type="button"
              disabled={none}
              onClick={() => resolveSelected({ kind: 'project', parentId })}
              className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              {t('inbox.makeProjects')}
            </button>
            {onBulkDelete && (
              <ConfirmButton
                aria-label={t('inbox.deleteSelectedAria')}
                message={t('inbox.deleteSelectedConfirm', { count: selected.size })}
                onConfirm={() => {
                  onBulkDelete([...selected]);
                  setSelected(new Set());
                }}
                disabled={none}
                className="rounded-md px-2 py-0.5 font-medium text-destructive hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              >
                {t('common.delete')}
              </ConfirmButton>
            )}
            <button
              type="button"
              onClick={() => setSelected(new Set(items.map((n) => n.id)))}
              disabled={selected.size === items.length}
              className="ml-auto rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              {t('common.selectAll')}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={none}
              className="rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              {t('common.clear')}
            </button>
          </div>
        )}
      </div>

      {pickerOpen && (
        <ProjectPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title={t('inbox.fileUnderTitle')}
          confirmLabel={t('common.choose')}
          targets={[{ id: '', label: t('inbox.defaultTarget') }, ...projectTargets]}
          initialSelectedId={bulkTarget}
          onConfirm={setBulkTarget}
        />
      )}

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('inbox.empty')}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2 transition-colors even:bg-muted/40 hover:bg-accent/40">
              {selectMode && (
                <input
                  type="checkbox"
                  aria-label={t('inbox.selectItemAria', { title: item.title })}
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="shrink-0"
                />
              )}
              {renamingId === item.id && onRename ? (
                <div className="flex-1">
                  <InlineRename
                    title={item.title}
                    onCommit={(t) => { onRename(item.id, t); setRenamingId(null); }}
                    onCancel={() => setRenamingId(null)}
                  />
                </div>
              ) : (
                <span
                  className="flex-1 text-sm text-foreground"
                  onDoubleClick={onRename && !selectMode ? () => setRenamingId(item.id) : undefined}
                >
                  {item.title}
                </span>
              )}
              {(() => {
                const age = formatAge(item.updatedAt ?? item.createdAt ?? '');
                return age ? (
                  <span
                    className={cn(
                      'text-[11px]',
                      age.stale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                    )}
                  >
                    {age.label}
                  </span>
                ) : null;
              })()}
              {!selectMode && renamingId !== item.id && (
                <CopyButton value={item.title} label={`name "${item.title}"`} className="p-1.5" />
              )}
              {!selectMode && onRename && renamingId !== item.id && (
                <button
                  type="button"
                  aria-label={t('inbox.renameAria', { title: item.title })}
                  onClick={() => setRenamingId(item.id)}
                  className={cn('rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground', TOUCH_TARGET)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {!selectMode && (
                <button
                  type="button"
                  aria-label={t('inbox.processAria', { title: item.title })}
                  onClick={() => onProcess(item.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
                >
                  {t('inbox.processButton')}
                </button>
              )}
              {!selectMode && (
                <button
                  type="button"
                  aria-label={t('inbox.deleteAria', { title: item.title })}
                  onClick={() => onDelete(item.id)}
                  className={cn('rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive', TOUCH_TARGET)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
