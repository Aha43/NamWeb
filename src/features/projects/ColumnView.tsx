import { useState, type FormEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { ActionList, ActionRow } from '../actions/ActionRow';
import { StatusMenu } from '../actions/StatusMenu';
import { ReorderControls } from '../actions/ReorderControls';
import type { ActionRowData } from '../actions/rows';
import type { NodeStatus } from '../../domain/types';

export interface WorkbenchColumn {
  /** The node whose direct actions this column holds (the project itself for Unsorted). */
  id: string;
  title: string;
  /** The leading column = the project's own direct actions. */
  isUnsorted: boolean;
  actions: ActionRowData[];
}

export interface ColumnViewProps {
  columns: WorkbenchColumn[];
  onOpenColumn: (id: string) => void;
  onAddAction: (columnId: string, title: string) => void;
  onMoveAction: (columnId: string, id: string, direction: 'up' | 'down') => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/** Kanban-style columns: Unsorted (the project's own actions) + one per sub-project. Presentational.
 *  Cross-column moves use the action editor's Move to… (drag-to-reparent lands in a later phase). */
export function ColumnView({
  columns,
  onOpenColumn,
  onAddAction,
  onMoveAction,
  onSetStatus,
  onEdit,
  onRename,
}: ColumnViewProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div
          key={col.id}
          className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-card/40 p-2"
        >
          <div className="flex items-center justify-between px-1">
            {col.isUnsorted ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Unsorted
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Open ${col.title}`}
                onClick={() => onOpenColumn(col.id)}
                className="flex items-center gap-1 truncate text-sm font-medium text-foreground hover:underline"
              >
                <span className="truncate">{col.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">{col.actions.length}</span>
          </div>

          {col.actions.length > 0 && (
            <ActionList>
              {col.actions.map((row, index) => (
                <ActionRow
                  key={row.id}
                  row={row}
                  onEdit={() => onEdit(row.id)}
                  onRename={(title) => onRename(row.id, title)}
                  actions={
                    <div className="flex items-center gap-1">
                      <ReorderControls
                        title={row.title}
                        onUp={index > 0 ? () => onMoveAction(col.id, row.id, 'up') : undefined}
                        onDown={
                          index < col.actions.length - 1
                            ? () => onMoveAction(col.id, row.id, 'down')
                            : undefined
                        }
                      />
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

          <ColumnAdd label={col.isUnsorted ? 'Unsorted' : col.title} onAdd={(title) => onAddAction(col.id, title)} />
        </div>
      ))}
    </div>
  );
}

function ColumnAdd({ label, onAdd }: { label: string; onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }
  return (
    <form onSubmit={submit}>
      <input
        aria-label={`Add action to ${label}`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add an action…"
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
      />
    </form>
  );
}
