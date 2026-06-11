import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import { SortButton } from '../actions/SortButton';
import { StatusMenu } from '../actions/StatusMenu';
import type { SortMode } from '../actions/sort';
import type { ActionRowData } from '../actions/rows';
import type { NodeStatus } from '@/domain/types';

export interface BacklogPanelProps {
  rows: ActionRowData[];
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  sortMode?: SortMode;
  onCycleSort?: () => void;
}

/** Backlog: the list with an inline status switch. Presentational. */
export function BacklogPanel({ rows, onSetStatus, onEdit, onRename, sortMode, onCycleSort }: BacklogPanelProps) {
  return (
    <section className="mx-auto max-w-md">
      {sortMode && onCycleSort && rows.length > 0 && (
        <div className="mb-2 flex justify-end">
          <SortButton mode={sortMode} onCycle={onCycleSort} />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState>Backlog is empty.</EmptyState>
      ) : (
        <ActionList>
          {rows.map((row) => (
            <ActionRow
              key={row.id}
              row={row}
              onEdit={onEdit && (() => onEdit(row.id))}
              onRename={onRename && ((title) => onRename(row.id, title))}
              actions={
                <StatusMenu
                  status="BACKLOG"
                  title={row.title}
                  onSetStatus={(status) => onSetStatus(row.id, status)}
                />
              }
            />
          ))}
        </ActionList>
      )}
    </section>
  );
}
