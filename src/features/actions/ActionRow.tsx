import { useState, type CSSProperties, type ReactNode } from 'react';
import { Paperclip, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAge, formatDate, formatDueHint, type DueTone } from '@/lib/dates';
import { useSettings } from '@/components/settings/settings-context';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { CopyButton } from '@/components/ui/copy-button';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { InlineRename } from './InlineRename';
import { ProjectPathLinks } from './ProjectPathLinks';
import { TOUCH_TARGET } from '@/lib/touch';
import { descriptionTooltip, type ActionRowData } from './rows';

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
  selectable = false,
  selected = false,
  onSelectedChange,
  variant = 'row',
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
  /** Show a leading selection checkbox (multi-select / bulk ops). */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** `row` (default) = the horizontal list row. `card` = a compact Kanban card for the Column view:
   *  title on its own line, no project path/age, controls in a hover-revealed footer (#445). */
  variant?: 'row' | 'card';
}) {
  const { dateFormat } = useSettings();
  const due = row.dueAt ? formatDueHint(row.dueAt, undefined, dateFormat) : null;
  // A date range: append the end date when it's set and not before the start.
  const dueEnd =
    row.dueAt && row.dueEndAt && row.dueEndAt >= row.dueAt ? formatDate(row.dueEndAt, dateFormat) : null;
  // Optional time of day on the start, shown after the date (#493).
  const dueTime = row.dueAt && row.dueTime ? row.dueTime : null;
  // Optional time of day on the end, shown after the end date (#500).
  const dueEndTime = dueEnd && row.dueEndTime ? row.dueEndTime : null;
  const isCard = variant === 'card';
  // The age label is list-only noise on a Kanban card (nearly every card would read "today").
  const age = !isCard && row.touchedAt ? formatAge(row.touchedAt) : null;
  const [renaming, setRenaming] = useState(false);

  // When a row has notes, hovering its title shows them (truncated). Use a plain truncating title
  // then (its own full-title tooltip would otherwise nest inside this one).
  const descTip = descriptionTooltip(row.description);
  const titleInner = descTip ? (
    <span className="block truncate text-sm text-foreground">{row.title}</span>
  ) : (
    <TruncatedTitle text={row.title} className="block text-sm text-foreground" />
  );
  const titleEl = onEdit ? (
    // Click the title to open the editor (replaces the old slider/edit icon).
    <button type="button" aria-label={`Edit ${row.title}`} onClick={onEdit} className="block w-full text-left">
      {titleInner}
    </button>
  ) : (
    titleInner
  );

  const checkbox = selectable ? (
    <input
      type="checkbox"
      aria-label={`Select ${row.title}`}
      checked={selected}
      onChange={(e) => onSelectedChange?.(e.target.checked)}
      className="shrink-0"
    />
  ) : null;

  const titleNode =
    renaming && onRename ? (
      <InlineRename
        title={row.title}
        onCommit={(t) => { onRename(t); setRenaming(false); }}
        onCancel={() => setRenaming(false)}
      />
    ) : descTip ? (
      <Tooltip label={descTip}>{titleEl}</Tooltip>
    ) : (
      titleEl
    );

  const hasMeta = row.tags.length > 0 || (row.inheritedTags?.length ?? 0) > 0 || !!due || !!age || !!row.hasResources;
  const metaNode = hasMeta ? (
    <div className="mt-0.5 flex flex-wrap items-center gap-1">
      {row.hasResources && (
        <Paperclip aria-label="Has resources" className="h-3 w-3 text-muted-foreground" />
      )}
      {row.tags.map((tag) => (
        <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {tag}
        </span>
      ))}
      {row.inheritedTags?.map((tag) => (
        <span
          key={`inh-${tag}`}
          title="From project"
          className="rounded bg-muted px-1.5 py-0.5 text-[11px] italic text-muted-foreground"
        >
          {tag}
        </span>
      ))}
      {due && (
        <span className={cn('text-[11px] font-medium whitespace-nowrap', DUE_TONE[due.tone])}>
          Due {due.label}
          {dueTime && ` ${dueTime}`}
          {dueEnd && ` – ${dueEnd}`}
          {dueEndTime && ` ${dueEndTime}`}
        </span>
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
  ) : null;

  const actionsNode = (
    <>
      <CopyButton value={row.title} label={`name "${row.title}"`} className="p-2" />
      {onRename && !renaming && (
        <Tooltip label={`Rename ${row.title}`}>
          <button
            type="button"
            aria-label={`Rename ${row.title}`}
            onClick={() => setRenaming(true)}
            className={cn('rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground', TOUCH_TARGET)}
          >
            <Pencil className="h-3.5 w-3.5" />
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
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ConfirmButton>
      )}
    </>
  );

  // Kanban card: title gets a full line; controls drop to a footer that fades in on hover/focus so
  // they never compete with the title for the column's narrow width (#445). (Column view is desktop,
  // so hover-reveal is fine; the footer stays in the DOM — opacity, not display — for a11y + tests.)
  if (isCard) {
    return (
      <li
        ref={dragRef}
        style={dragStyle}
        className="group list-none rounded-md border border-border bg-card/60 p-2 transition-colors hover:bg-accent/40"
      >
        <div className="flex items-start gap-2">
          {checkbox}
          <div className="min-w-0 flex-1">
            {titleNode}
            {metaNode}
          </div>
        </div>
        <div className="mt-1 flex items-center justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {actionsNode}
        </div>
      </li>
    );
  }

  return (
    <li
      ref={dragRef}
      style={dragStyle}
      className="flex items-center gap-2 px-3 py-2 transition-colors even:bg-muted/40 hover:bg-accent/40"
    >
      {checkbox}
      <div className="min-w-0 flex-1">
        <ProjectPathLinks path={row.path} className="truncate text-xs text-muted-foreground" />
        {titleNode}
        {metaNode}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actionsNode}
      </div>
    </li>
  );
}

export function ActionList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">{children}</ul>
  );
}

/** An empty state that teaches: a headline (what's here / why it's empty), an optional `hint`
 *  describing the surface's purpose, and an optional `action` (e.g. a button). */
export function EmptyState({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{children}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
