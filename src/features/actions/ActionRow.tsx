import { useState, type CSSProperties, type ReactNode } from 'react';
import { Paperclip, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAge, formatDueHint, type DueTone } from '@/lib/dates';
import { useSettings } from '@/components/settings/settings-context';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { InlineRename } from './InlineRename';
import { ProjectPathLinks } from './ProjectPathLinks';
import type { ActionRowData } from './rows';

const DUE_TONE: Record<DueTone, string> = {
  overdue: 'text-red-600 dark:text-red-400',
  today: 'text-amber-600 dark:text-amber-400',
  soon: 'text-blue-600 dark:text-blue-400',
  later: 'text-muted-foreground',
};

/** One action row: project path, title, tags, due hint, and a slot for actions. */
export function ActionRow({
  row,
  actions,
  onEdit,
  onDelete,
  onRename,
  dragRef,
  dragStyle,
}: {
  row: ActionRowData;
  actions: ReactNode;
  onEdit?: () => void;
  /** Delete this row inline (the caller confirms). Renders a trailing trash button. */
  onDelete?: () => void;
  /** Commit an inline title rename (double-click the title to start). */
  onRename?: (title: string) => void;
  /** Sortable wiring (drag-and-drop): ref + transform style for the row element. */
  dragRef?: (el: HTMLElement | null) => void;
  dragStyle?: CSSProperties;
}) {
  const { dateFormat } = useSettings();
  const due = row.dueAt ? formatDueHint(row.dueAt, undefined, dateFormat) : null;
  const age = row.touchedAt ? formatAge(row.touchedAt) : null;
  const [renaming, setRenaming] = useState(false);
  return (
    <li ref={dragRef} style={dragStyle} className="flex items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <ProjectPathLinks path={row.path} className="truncate text-xs text-muted-foreground" />
        {renaming && onRename ? (
          <InlineRename
            title={row.title}
            onCommit={(t) => { onRename(t); setRenaming(false); }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <TruncatedTitle text={row.title} className="text-sm text-foreground" />
        )}
        {(row.tags.length > 0 || due || age || row.hasResources) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {row.hasResources && (
              <Paperclip aria-label="Has resources" className="h-3 w-3 text-muted-foreground" />
            )}
            {row.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {tag}
              </span>
            ))}
            {due && (
              <span className={cn('text-[11px] font-medium', DUE_TONE[due.tone])}>Due {due.label}</span>
            )}
            {age && (
              <span
                className={cn(
                  'text-[11px]',
                  age.stale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                )}
              >
                {age.label}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onRename && !renaming && (
          <Tooltip label={`Rename ${row.title}`}>
            <button
              type="button"
              aria-label={`Rename ${row.title}`}
              onClick={() => setRenaming(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
        {onEdit && (
          <Tooltip label={`Edit ${row.title}`}>
            <button
              type="button"
              aria-label={`Edit ${row.title}`}
              onClick={onEdit}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
        {actions}
        {onDelete && (
          <ConfirmButton
            aria-label={`Delete ${row.title}`}
            message={
              (row.descendantCount ?? 0) > 0
                ? `Delete "${row.title}" and its ${row.descendantCount} item${row.descendantCount === 1 ? '' : 's'}?`
                : `Delete "${row.title}"?`
            }
            onConfirm={onDelete}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </ConfirmButton>
        )}
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
