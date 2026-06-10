import { useState, type FormEvent } from 'react';
import type { NamNode } from '../../domain/types';

export interface InboxPanelProps {
  items: NamNode[];
  onAdd: (title: string) => void;
  onConvert: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Inbox: quick-add capture plus the list of unprocessed items. Pure/presentational. */
export function InboxPanel({ items, onAdd, onConvert, onDelete }: InboxPanelProps) {
  const [title, setTitle] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <input
          aria-label="Quick add"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add to inbox…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Add
        </button>
      </form>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Inbox zero. Nothing to process.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2">
              <span className="flex-1 text-sm text-slate-800">{item.title}</span>
              <button
                type="button"
                aria-label={`Convert ${item.title} to next action`}
                onClick={() => onConvert(item.id)}
                className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                → Next
              </button>
              <button
                type="button"
                aria-label={`Delete ${item.title}`}
                onClick={() => onDelete(item.id)}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
