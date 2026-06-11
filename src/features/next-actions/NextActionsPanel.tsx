import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import { SortButton } from '../actions/SortButton';
import type { SortMode } from '../actions/sort';
import type { ActionRowData } from '../actions/rows';

export interface NextActionsPanelProps {
  rows: ActionRowData[];
  onMarkDone: (id: string) => void;
  onMarkBacklog: (id: string) => void;
  onEdit?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  sortMode?: SortMode;
  onCycleSort?: () => void;
}

/** Next Actions: the list with mark-done and send-to-backlog. Presentational. */
export function NextActionsPanel({
  rows,
  onMarkDone,
  onMarkBacklog,
  onEdit,
  onRename,
  sortMode,
  onCycleSort,
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
          {rows.map((row) => (
            <ActionRow
              key={row.id}
              row={row}
              onEdit={onEdit && (() => onEdit(row.id))}
              onRename={onRename && ((title) => onRename(row.id, title))}
              actions={
                <>
                  <button
                    type="button"
                    aria-label={`Mark ${row.title} done`}
                    onClick={() => onMarkDone(row.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${row.title} to backlog`}
                    onClick={() => onMarkBacklog(row.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Backlog
                  </button>
                </>
              }
            />
          ))}
        </ActionList>
      )}
    </section>
  );
}
