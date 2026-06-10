import type { ReactNode } from 'react';
import type { ActionRowData } from './rows';

/** One action row: project path, title, tags, due hint, and a slot for actions. */
export function ActionRow({ row, actions }: { row: ActionRowData; actions: ReactNode }) {
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        {row.path.length > 0 && (
          <p className="truncate text-xs text-slate-400">{row.path.join(' › ')}</p>
        )}
        <p className="truncate text-sm text-slate-800">{row.title}</p>
        {(row.tags.length > 0 || row.dueAt) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {row.tags.map((tag) => (
              <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                {tag}
              </span>
            ))}
            {row.dueAt && <span className="text-[11px] font-medium text-amber-700">Due {row.dueAt}</span>}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </li>
  );
}

export function ActionList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">{children}</ul>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-400">{children}</p>;
}
