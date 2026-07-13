import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { AddPositionToggle } from '@/components/settings/AddPositionToggle';
import { EmptyState } from '../actions/ActionRow';
import { SortButton } from '../actions/SortButton';
import { StatusMenu } from '../actions/StatusMenu';
import { ReorderControls } from '../actions/ReorderControls';
import { ReorderableActionList } from '@/components/dnd/ReorderableActionList';
import { MoveActionMenu } from '../projects/picker/MoveActionMenu';
import type { PickerTarget } from '../projects/picker/pickerModel';
import type { SortMode } from '../actions/sort';
import type { ActionRowData } from '../actions/rows';
import type { QuickMoveTarget } from '@/domain/lenses';
import type { NodeStatus } from '@/domain/types';

export interface NextActionsPanelProps {
  rows: ActionRowData[];
  /** Quick-add a next action directly from this view. */
  onAdd?: (title: string) => void;
  /** Inline delete (with confirm) per row. */
  onDelete?: (id: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  /** Proximate destinations for the per-row move-into-project menu (#688). */
  moveTargets?: (id: string) => QuickMoveTarget[];
  /** Full "Browse all projects…" destination set for the move picker. */
  moveBrowseTargets?: (id: string) => PickerTarget[];
  /** Move the action under `targetId` (a project, or the Free-actions root). */
  onMoveInto?: (id: string, targetId: string) => void;
  /** Create a project inside the browse picker ("New project here"). */
  onCreateProject?: (parentId: string | null, title: string) => string;
  sortMode?: SortMode;
  onCycleSort?: () => void;
  /** Manual ordering is available (the list is in "Unsorted" mode). */
  reorderable?: boolean;
  onMove?: (id: string, direction: 'up' | 'down') => void;
  /** Commit a drag reorder (the full new id order). Drag is offered only when this is set. */
  onReorder?: (ids: string[]) => void;
  /** Whether drag-and-drop is mounted (desktop). Buttons remain regardless. */
  dndEnabled?: boolean;
  /** The Focus entry point (a FocusButton) — pinned in the sticky header so it stays reachable. */
  focusSlot?: ReactNode;
  /** The status include-boxes (#766), pinned with Focus/Sort. */
  statusSlot?: ReactNode;
}

/** Next Actions: the list with an inline status switch + manual reorder (buttons + desktop drag).
 *  Presentational. */
export function NextActionsPanel({
  rows,
  onAdd,
  onDelete,
  onSetStatus,
  onEdit,
  onRename,
  moveTargets,
  moveBrowseTargets,
  onMoveInto,
  onCreateProject,
  sortMode,
  onCycleSort,
  reorderable,
  onMove,
  onReorder,
  dndEnabled,
  focusSlot,
  statusSlot,
}: NextActionsPanelProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');

  function submitAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !onAdd) return;
    onAdd(trimmed);
    setTitle('');
  }

  return (
    <section>
      {/* Pin the add box + sort so you can always capture/sort while the list scrolls under. */}
      <div className="sticky top-0 z-10 bg-background pt-1">
        {onAdd && (
          <form onSubmit={submitAdd} className="mb-4 flex gap-2">
            <input
              aria-label={t('next.addAria')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('next.addPlaceholder')}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
            />
            <AddPositionToggle />
            <Button type="submit">{t('common.add')}</Button>
          </form>
        )}
        {(focusSlot || statusSlot || (sortMode && onCycleSort && rows.length > 0)) && (
          <div className="mb-2 flex items-center justify-end gap-1">
            {statusSlot && <div className="mr-auto">{statusSlot}</div>}
            {focusSlot}
            {sortMode && onCycleSort && rows.length > 0 && <SortButton mode={sortMode} onCycle={onCycleSort} />}
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState hint={t('next.emptyHint')}>{t('next.empty')}</EmptyState>
      ) : (
        <ReorderableActionList
          rows={rows}
          colorByStatus={false} // every row is NEXT here — status color adds nothing
          onEdit={onEdit}
          onDelete={onDelete}
          onRename={onRename}
          onReorder={reorderable ? onReorder : undefined}
          dndEnabled={dndEnabled}
          renderActions={(row, index) => (
            <>
              {reorderable && onMove && (
                <ReorderControls
                  title={row.title}
                  onUp={index > 0 ? () => onMove(row.id, 'up') : undefined}
                  onDown={index < rows.length - 1 ? () => onMove(row.id, 'down') : undefined}
                />
              )}
              {onMoveInto && moveTargets && (
                <MoveActionMenu
                  title={row.title}
                  quickTargets={moveTargets(row.id)}
                  browseTargets={() => moveBrowseTargets?.(row.id) ?? []}
                  onMove={(targetId) => onMoveInto(row.id, targetId)}
                  onCreateProject={onCreateProject}
                />
              )}
              <StatusMenu
                status={row.status}
                title={row.title}
                onSetStatus={(status) => onSetStatus(row.id, status)}
              />
            </>
          )}
        />
      )}
    </section>
  );
}
