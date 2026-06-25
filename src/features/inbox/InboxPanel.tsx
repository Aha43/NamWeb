import { useState, type FormEvent } from 'react';
import { Pencil, Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { AddPositionToggle } from '@/components/settings/AddPositionToggle';
import { cn } from '@/lib/utils';
import { formatAge } from '@/lib/dates';
import { InlineRename } from '../actions/InlineRename';
import type { NamNode } from '../../domain/types';

export interface InboxPanelProps {
  items: NamNode[];
  onAdd: (title: string) => void;
  onProcess: (id: string) => void;
  /** Start the one-at-a-time process-all deck. */
  onProcessAll?: () => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void;
}

/** Inbox: quick-add capture plus the list of unprocessed items. Pure/presentational. */
export function InboxPanel({ items, onAdd, onProcess, onProcessAll, onDelete, onRename }: InboxPanelProps) {
  const [title, setTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }

  return (
    <section className="space-y-4">
      {/* Pin the add box + Process button so they stay reachable while the inbox list scrolls. */}
      <div className="sticky top-0 z-10 space-y-4 bg-background pt-1">
        <form onSubmit={submit} className="flex gap-2">
          <input
            aria-label="Quick add"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add to inbox…"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
          />
          <AddPositionToggle />
          <Button type="submit">Add</Button>
        </form>

        {onProcessAll && items.length > 0 && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onProcessAll}>
              <Target className="h-4 w-4 focus-glow" />
              Process inbox ({items.length})
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Inbox zero. Nothing to process.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2 transition-colors even:bg-muted/40 hover:bg-accent/40">
              {renamingId === item.id && onRename ? (
                <div className="flex-1">
                  <InlineRename
                    title={item.title}
                    onCommit={(t) => { onRename(item.id, t); setRenamingId(null); }}
                    onCancel={() => setRenamingId(null)}
                  />
                </div>
              ) : (
                <span
                  className="flex-1 text-sm text-foreground"
                  onDoubleClick={onRename ? () => setRenamingId(item.id) : undefined}
                >
                  {item.title}
                </span>
              )}
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
              {renamingId !== item.id && (
                <CopyButton value={item.title} label={`name "${item.title}"`} className="p-1.5" />
              )}
              {onRename && renamingId !== item.id && (
                <button
                  type="button"
                  aria-label={`Rename ${item.title}`}
                  onClick={() => setRenamingId(item.id)}
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
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
