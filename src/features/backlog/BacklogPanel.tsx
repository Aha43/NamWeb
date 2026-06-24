import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AddPositionToggle } from '@/components/settings/AddPositionToggle';
import { EmptyState } from '../actions/ActionRow';
import { SortButton } from '../actions/SortButton';
import { StatusMenu } from '../actions/StatusMenu';
import { ReorderControls } from '../actions/ReorderControls';
import { ReorderableActionList } from '@/components/dnd/ReorderableActionList';
import type { SortMode } from '../actions/sort';
import type { ActionRowData } from '../actions/rows';
import type { NodeStatus } from '@/domain/types';

export interface BacklogPanelProps {
  rows: ActionRowData[];
  /** Quick-add an action straight into the backlog. */
  onAdd?: (title: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit?: (id: string) => void;
  /** Inline delete (with confirm) per row. */
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  sortMode?: SortMode;
  onCycleSort?: () => void;
  /** Manual ordering is available (the list is in "Unsorted" mode). */
  reorderable?: boolean;
  onMove?: (id: string, direction: 'up' | 'down') => void;
  /** Commit a drag reorder (the full new id order). Drag is offered only when this is set. */
  onReorder?: (ids: string[]) => void;
  /** Whether drag-and-drop is mounted (desktop). Buttons remain regardless. */
  dndEnabled?: boolean;
}

/** Backlog: the list with an inline status switch + manual reorder (buttons + desktop drag).
 *  Presentational. */
export function BacklogPanel({
  rows,
  onAdd,
  onSetStatus,
  onEdit,
  onDelete,
  onRename,
  sortMode,
  onCycleSort,
  reorderable,
  onMove,
  onReorder,
  dndEnabled,
}: BacklogPanelProps) {
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
      {onAdd && (
        <form onSubmit={submitAdd} className="mb-4 flex gap-2">
          <input
            aria-label="Add to backlog"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add to backlog…"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
          />
          <AddPositionToggle />
          <Button type="submit">Add</Button>
        </form>
      )}
      {sortMode && onCycleSort && rows.length > 0 && (
        <div className="mb-2 flex justify-end">
          <SortButton mode={sortMode} onCycle={onCycleSort} />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState hint="Things to do later — not now. Park actions here, then promote them to Next when you're ready.">
          Backlog is empty
        </EmptyState>
      ) : (
        <ReorderableActionList
          rows={rows}
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
