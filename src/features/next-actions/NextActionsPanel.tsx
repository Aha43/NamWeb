import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import { SortButton } from '../actions/SortButton';
import { StatusMenu } from '../actions/StatusMenu';
import { ReorderControls } from '../actions/ReorderControls';
import type { SortMode } from '../actions/sort';
import type { ActionRowData } from '../actions/rows';
import type { NodeStatus } from '@/domain/types';

export interface NextActionsPanelProps {
  rows: ActionRowData[];
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  sortMode?: SortMode;
  onCycleSort?: () => void;
  /** Manual ordering is available (the list is in "Unsorted" mode). */
  reorderable?: boolean;
  onMove?: (id: string, direction: 'up' | 'down') => void;
}

/** Next Actions: the list with an inline status switch + manual reorder. Presentational. */
export function NextActionsPanel({
  rows,
  onSetStatus,
  onEdit,
  onRename,
  sortMode,
  onCycleSort,
  reorderable,
  onMove,
}: NextActionsPanelProps) {
  return (
    <section className="mx-auto max-w-md">
      {sortMode && onCycleSort && rows.length > 0 && (
        <div className="mb-2 flex justify-end">
          <SortButton mode={sortMode} onCycle={onCycleSort} />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState>No next actions.</EmptyState>
      ) : (
        <ActionList>
          {rows.map((row, index) => (
            <ActionRow
              key={row.id}
              row={row}
              onEdit={onEdit && (() => onEdit(row.id))}
              onRename={onRename && ((title) => onRename(row.id, title))}
              actions={
                <div className="flex items-center gap-1">
                  {reorderable && onMove && (
                    <ReorderControls
                      title={row.title}
                      onUp={index > 0 ? () => onMove(row.id, 'up') : undefined}
                      onDown={index < rows.length - 1 ? () => onMove(row.id, 'down') : undefined}
                    />
                  )}
                  <StatusMenu
                    status={row.status}
                    title={row.title}
                    onSetStatus={(status) => onSetStatus(row.id, status)}
                  />
                </div>
              }
            />
          ))}
        </ActionList>
      )}
    </section>
  );
}
