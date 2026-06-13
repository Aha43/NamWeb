import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import type { ActionRowData } from '../actions/rows';

export interface DonePanelProps {
  rows: ActionRowData[];
  onRestore: (id: string) => void;
  onBacklog: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
}

/** Done: completed actions with restore / backlog / delete. Presentational. */
export function DonePanel({ rows, onRestore, onBacklog, onDelete, onEdit }: DonePanelProps) {
  return (
    <section className="mx-auto max-w-2xl">
      {rows.length === 0 ? (
        <EmptyState>Nothing done yet.</EmptyState>
      ) : (
        <ActionList>
          {rows.map((row) => (
            <ActionRow
              key={row.id}
              row={row}
              onEdit={onEdit && (() => onEdit(row.id))}
              actions={
                <>
                  <button
                    type="button"
                    aria-label={`Restore ${row.title} to next`}
                    onClick={() => onRestore(row.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${row.title} to backlog`}
                    onClick={() => onBacklog(row.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Backlog
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${row.title}`}
                    onClick={() => onDelete(row.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    Delete
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
