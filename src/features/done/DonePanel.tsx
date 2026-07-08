import { useState, type ReactNode } from 'react';
import { CheckSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TOUCH_TARGET } from '@/lib/touch';
import type { ActionRowData } from '../actions/rows';

export interface DonePanelProps {
  rows: ActionRowData[];
  onRestore: (id: string) => void;
  onBacklog: (id: string) => void;
  onDelete: (id: string) => void;
  /** Bulk delete with a single Undo toast; falls back to per-id `onDelete` when absent. */
  onDeleteMany?: (ids: string[]) => void;
  /** Bulk restore-to-Next with a single Undo toast; falls back to per-id `onRestore` when absent. */
  onRestoreMany?: (ids: string[]) => void;
  /** Bulk move-to-Backlog with a single Undo toast; falls back to per-id `onBacklog` when absent. */
  onBacklogMany?: (ids: string[]) => void;
  onEdit?: (id: string) => void;
  /** The Focus entry point (a FocusButton) — pinned in the sticky header so it stays reachable. */
  focusSlot?: ReactNode;
}

/** Done: completed actions with restore / backlog / delete — plus a select mode for bulk ops
 *  (you often spot several that were not actually done). Presentational. */
export function DonePanel({ rows, onRestore, onBacklog, onDelete, onDeleteMany, onRestoreMany, onBacklogMany, onEdit, focusSlot }: DonePanelProps) {
  const { t } = useTranslation();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
  };
  // Apply an action to the selected rows, then clear the selection (stay in select mode).
  // Prefer the bulk variant (one grouped Undo toast) over per-id calls.
  const bulk = (fn: (id: string) => void, many?: (ids: string[]) => void) => {
    if (many) many([...selected]);
    else for (const id of selected) fn(id);
    setSelected(new Set());
  };
  const bulkDelete = () => {
    const ids = [...selected];
    if (onDeleteMany) onDeleteMany(ids);
    else for (const id of ids) onDelete(id);
    setSelected(new Set());
  };
  const none = selected.size === 0;

  if (rows.length === 0) {
    return (
      <section>
        <EmptyState hint={t('done.emptyHint')}>{t('done.empty')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      {/* Pin the Focus entry + select toggle (and the bulk bar) while the list scrolls under. */}
      <div className="sticky top-0 z-10 space-y-2 bg-background pt-1">
      <div className="flex items-center justify-end gap-1">
        {focusSlot}
        <Tooltip label={selectMode ? t('list.exitSelect') : t('done.selectActions')}>
          <button
            type="button"
            aria-label={selectMode ? t('list.exitSelect') : t('done.selectActions')}
            aria-pressed={selectMode}
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            className={cn(
              'rounded-md p-1 hover:bg-accent hover:text-foreground',
              TOUCH_TARGET,
              selectMode ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <CheckSquare className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>

      {selectMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
          <span className="mr-1 text-muted-foreground">{t('actions.selectedCount', { count: selected.size })}</span>
          <button
            type="button"
            onClick={() => bulk(onRestore, onRestoreMany)}
            disabled={none}
            className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
          >
            {t('done.restoreToNext')}
          </button>
          <button
            type="button"
            onClick={() => bulk(onBacklog, onBacklogMany)}
            disabled={none}
            className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
          >
            {t('domain.status.backlog')}
          </button>
          <ConfirmButton
            aria-label={t('done.deleteSelectedAria')}
            message={t('done.deleteSelectedConfirm', { count: selected.size })}
            onConfirm={bulkDelete}
            disabled={none}
            className="rounded-md px-2 py-0.5 font-medium text-destructive hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
          >
            {t('common.delete')}
          </ConfirmButton>
          <button
            type="button"
            onClick={() => setSelected(new Set(rows.map((r) => r.id)))}
            disabled={selected.size === rows.length}
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

      <ActionList>
        {rows.map((row) => (
          <ActionRow
            key={row.id}
            row={row}
            colorByStatus={false} // every row is DONE here — status color adds nothing
            onEdit={onEdit && (() => onEdit(row.id))}
            onDelete={selectMode ? undefined : () => onDelete(row.id)}
            selectable={selectMode}
            selected={selected.has(row.id)}
            onSelectedChange={() => toggle(row.id)}
            actions={
              selectMode ? null : (
                <>
                  <button
                    type="button"
                    aria-label={t('done.restoreAria', { title: row.title })}
                    onClick={() => onRestore(row.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
                  >
                    {t('done.restore')}
                  </button>
                  <button
                    type="button"
                    aria-label={t('done.backlogAria', { title: row.title })}
                    onClick={() => onBacklog(row.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {t('domain.status.backlog')}
                  </button>
                </>
              )
            }
          />
        ))}
      </ActionList>
    </section>
  );
}
