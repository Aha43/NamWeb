import { useState, type CSSProperties, type ReactNode } from 'react';
import { MoreHorizontal, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatAge } from '@/lib/dates';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { CopyButton } from '@/components/ui/copy-button';
import { InProgressToggle } from '@/features/tags/InProgressToggle';
import { isSystemTag } from '@/domain/systemTags';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { InlineRename } from './InlineRename';
import { DueHintLabel } from './DueHintLabel';
import { useSettings } from '@/components/settings/settings-context';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { STATUS_TEXT_TONE } from './status';
import { ProjectPathLinks } from './ProjectPathLinks';
import { TOUCH_TARGET } from '@/lib/touch';
import { descriptionTooltip, type ActionRowData } from './rows';

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
  colorByStatus = true,
  showPath = true,
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
  /** Tint the title by status (NEXT/DONE/BACKLOG) so status is scannable in mixed lists. Turn off in
   *  single-status views (Next/Backlog/Done, next-only Context) where every row shares one status. */
  colorByStatus?: boolean;
  /** Show the ancestor-project path above the title. Turn off where the path is redundant —
   *  e.g. inside a project page, whose header already names it (#569). */
  showPath?: boolean;
}) {
  const { t } = useTranslation();
  const isCard = variant === 'card';
  // The age label is list-only noise on a Kanban card (nearly every card would read "today").
  const age = !isCard && row.touchedAt ? formatAge(row.touchedAt, undefined, t) : null;
  const [renaming, setRenaming] = useState(false);

  // When a row has notes, hovering its title shows them (truncated). Use a plain truncating title
  // then (its own full-title tooltip would otherwise nest inside this one).
  const descTip = descriptionTooltip(row.description);
  const titleTone = colorByStatus ? STATUS_TEXT_TONE[row.status] ?? 'text-foreground' : 'text-foreground';
  const titleInner = descTip ? (
    <span className={cn('block truncate text-sm', titleTone)}>{row.title}</span>
  ) : (
    <TruncatedTitle text={row.title} className={cn('block text-sm', titleTone)} />
  );
  const titleEl = onEdit ? (
    // Click the title to open the editor (replaces the old slider/edit icon).
    <button type="button" aria-label={t('actions.editAria', { title: row.title })} onClick={onEdit} className="block w-full text-left">
      {titleInner}
    </button>
  ) : (
    titleInner
  );

  const checkbox = selectable ? (
    <input
      type="checkbox"
      aria-label={t('actions.selectAria', { title: row.title })}
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

  // Compact rows (#765): name + controls only — the meta line and path go, padding tightens.
  const { compactRows } = useSettings();
  // Phone rows reclaim their width (#776): the control strip hides behind a per-row "…" —
  // seven always-on icons were eating half of 390px and truncating every title.
  const isDesktop = useIsDesktop();
  const [controlsOpen, setControlsOpen] = useState(false);
  const hasMeta =
    !compactRows &&
    (row.tags.length > 0 || (row.inheritedTags?.length ?? 0) > 0 || !!row.dueAt || !!age || !!row.hasResources);
  const metaNode = hasMeta ? (
    <div className="mt-0.5 flex flex-wrap items-center gap-1">
      {row.hasResources && (
        <Paperclip aria-label={t('actions.hasResources')} className="h-3 w-3 text-muted-foreground" />
      )}
      {row.tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            'rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground',
            isSystemTag(tag) && 'font-semibold text-foreground', // system tags read as system (#651)
          )}
        >
          {tag}
        </span>
      ))}
      {row.inheritedTags?.map((tag) => (
        <span
          key={`inh-${tag}`}
          title={t('actions.fromProject')}
          className="rounded bg-muted px-1.5 py-0.5 text-[11px] italic text-muted-foreground"
        >
          {tag}
        </span>
      ))}
      <DueHintLabel dueAt={row.dueAt} dueEndAt={row.dueEndAt} dueTime={row.dueTime} dueEndTime={row.dueEndTime} />
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
      <InProgressToggle id={row.id} title={row.title} />
      <CopyButton value={row.title} label={t('copy.name', { title: row.title })} className="p-2" tooltip />
      {onRename && (
        /* Stays RENDERED (disabled) while renaming (#786/F2): hiding it reflowed the strip at
           the exact blur-commit moment, and the tap that ended the edit died on shifted ground. */
        <Tooltip label={t('actions.renameAria', { title: row.title })}>
          <button
            type="button"
            aria-label={t('actions.renameAria', { title: row.title })}
            disabled={renaming}
            onClick={() => setRenaming(true)}
            className={cn(
              'rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40',
              TOUCH_TARGET,
            )}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      )}
      {actions}
      {onDelete && (
        <ConfirmButton
          aria-label={t('actions.deleteAria', { title: row.title })}
          message={
            (row.descendantCount ?? 0) > 0
              ? t('actions.deleteConfirmWithChildren', { title: row.title, count: row.descendantCount })
              : t('actions.deleteConfirm', { title: row.title })
          }
          onConfirm={onDelete}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ConfirmButton>
      )}
    </>
  );

  // Kanban card: title gets a full line; controls float in (bottom-right) on hover/focus so they
  // never compete with the title for the column's narrow width (#445). The control row is taken OUT
  // of normal flow (absolute), so a resting card reserves no space for it — denser columns, more
  // cards per column, and (unlike collapsing the height) no layout shift on hover, which kept the
  // drag-and-drop stable (#514). It stays in the DOM (opacity, not `display:none`) so it's focusable
  // for keyboard users (`focus-within` reveals it) and findable in tests; `pointer-events-none` at
  // rest means it never blocks the card title underneath, and a backdrop keeps it legible on hover.
  if (isCard) {
    return (
      <li
        ref={dragRef}
        style={dragStyle}
        className="group relative list-none rounded-md border border-border bg-card/60 p-2 transition-colors hover:bg-accent/40"
      >
        <div className="flex items-start gap-2">
          {checkbox}
          <div className="min-w-0 flex-1">
            {titleNode}
            {metaNode}
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-1 right-1 flex items-center gap-0.5 rounded-md bg-card/95 opacity-0 shadow-sm transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          {actionsNode}
        </div>
      </li>
    );
  }

  if (!isDesktop) {
    // The controls stay in the DOM (display:none) so focus/queries behave; the "…" reveals
    // them on their own full-width line, then collapses again.
    return (
      <li
        ref={dragRef}
        style={dragStyle}
        className={cn('px-3 transition-colors even:bg-muted/40', compactRows ? 'py-0.5' : 'py-2')}
      >
        <div className="flex items-center gap-2">
          {checkbox}
          <div className="min-w-0 flex-1">
            {showPath && !compactRows && (
              <ProjectPathLinks path={row.path} className="truncate text-xs text-muted-foreground" />
            )}
            {titleNode}
            {metaNode}
          </div>
          <button
            type="button"
            aria-label={t('list.rowControlsAria', { title: row.title })}
            aria-expanded={controlsOpen}
            onClick={() => setControlsOpen((o) => !o)}
            className={cn(
              'shrink-0 rounded-md p-2 hover:text-foreground',
              controlsOpen ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
        <div className={cn('flex flex-wrap items-center justify-end gap-1 pb-1', !controlsOpen && 'hidden')}>
          {actionsNode}
        </div>
      </li>
    );
  }

  return (
    <li
      ref={dragRef}
      style={dragStyle}
      className={cn(
        'flex items-center gap-2 px-3 transition-colors even:bg-muted/40 hover:bg-accent/40',
        compactRows ? 'py-0.5' : 'py-2',
      )}
    >
      {checkbox}
      <div className="min-w-0 flex-1">
        {showPath && !compactRows && (
          <ProjectPathLinks path={row.path} className="truncate text-xs text-muted-foreground" />
        )}
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
