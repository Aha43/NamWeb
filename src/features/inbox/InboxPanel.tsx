import { useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatAge } from '@/lib/dates';
import type { NamNode } from '../../domain/types';

export interface InboxPanelProps {
  items: NamNode[];
  onAdd: (title: string) => void;
  onProcess: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
}

/** Inbox: quick-add capture plus the list of unprocessed items. Pure/presentational. */
export function InboxPanel({ items, onAdd, onProcess, onDelete, onEdit }: InboxPanelProps) {
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
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-ring"
        />
        <Button type="submit">Add</Button>
      </form>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Inbox zero. Nothing to process.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2">
              <span className="flex-1 text-sm text-foreground">{item.title}</span>
              {(() => {
                const age = formatAge(item.updatedAt ?? item.createdAt ?? '');
                return age ? (
                  <span
                    className={cn(
                      'text-[11px]',
                      age.stale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                    )}
                  >
                    {age.label}
                  </span>
                ) : null;
              })()}
              {onEdit && (
                <button
                  type="button"
                  aria-label={`Edit ${item.title}`}
                  onClick={() => onEdit(item.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Process ${item.title}`}
                onClick={() => onProcess(item.id)}
                className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
              >
                Process…
              </button>
              <button
                type="button"
                aria-label={`Delete ${item.title}`}
                onClick={() => onDelete(item.id)}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-destructive"
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
