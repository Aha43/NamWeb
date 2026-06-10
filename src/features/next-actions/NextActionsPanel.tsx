import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import type { ActionRowData } from '../actions/rows';

export interface NextActionsPanelProps {
  rows: ActionRowData[];
  onMarkDone: (id: string) => void;
  onMarkBacklog: (id: string) => void;
}

/** Next Actions: the list with mark-done and send-to-backlog. Presentational. */
export function NextActionsPanel({ rows, onMarkDone, onMarkBacklog }: NextActionsPanelProps) {
  return (
    <section className="mx-auto max-w-md">
      {rows.length === 0 ? (
        <EmptyState>No next actions.</EmptyState>
      ) : (
        <ActionList>
          {rows.map((row) => (
            <ActionRow
              key={row.id}
              row={row}
              actions={
                <>
                  <button
                    type="button"
                    aria-label={`Mark ${row.title} done`}
                    onClick={() => onMarkDone(row.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${row.title} to backlog`}
                    onClick={() => onMarkBacklog(row.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
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
