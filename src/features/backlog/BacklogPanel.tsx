import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import type { ActionRowData } from '../actions/rows';

export interface BacklogPanelProps {
  rows: ActionRowData[];
  onPromote: (id: string) => void;
  onEdit?: (id: string) => void;
}

/** Backlog: the list with a single promote-to-Next action. Presentational. */
export function BacklogPanel({ rows, onPromote, onEdit }: BacklogPanelProps) {
  return (
    <section className="mx-auto max-w-md">
      {rows.length === 0 ? (
        <EmptyState>Backlog is empty.</EmptyState>
      ) : (
        <ActionList>
          {rows.map((row) => (
            <ActionRow
              key={row.id}
              row={row}
              onEdit={onEdit && (() => onEdit(row.id))}
              actions={
                <button
                  type="button"
                  aria-label={`Promote ${row.title} to next`}
                  onClick={() => onPromote(row.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
                >
                  → Next
                </button>
              }
            />
          ))}
        </ActionList>
      )}
    </section>
  );
}
