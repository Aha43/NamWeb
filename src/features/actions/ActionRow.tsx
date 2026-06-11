import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import type { ActionRowData } from './rows';

/** One action row: project path, title, tags, due hint, and a slot for actions. */
export function ActionRow({
  row,
  actions,
  onEdit,
}: {
  row: ActionRowData;
  actions: ReactNode;
  onEdit?: () => void;
}) {
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        {row.path.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">{row.path.join(' › ')}</p>
        )}
        <p className="truncate text-sm text-foreground">{row.title}</p>
        {(row.tags.length > 0 || row.dueAt) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {row.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {tag}
              </span>
            ))}
            {row.dueAt && (
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Due {row.dueAt}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onEdit && (
          <button
            type="button"
            aria-label={`Edit ${row.title}`}
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {actions}
      </div>
    </li>
  );
}

export function ActionList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border rounded-lg border border-border bg-card">{children}</ul>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
