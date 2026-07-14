import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/shell/useIsDesktop';

/**
 * The list-header control row, arranged per device (#777): desktop keeps the inline furniture
 * exactly as it was (status boxes left, rows toggle / focus / sort right); the phone gets a
 * single **Filter** chip disclosing the boxes + rows toggle + sort stacked — Focus stays
 * visible beside the chip (a primary action, not a filter). The disclosure content stays in
 * the DOM (hidden) so queries and focus behave.
 */
export function ListHeaderControls({
  statusSlot,
  rowsToggle,
  focusSlot,
  sortSlot,
  filtered = false,
}: {
  statusSlot?: ReactNode;
  rowsToggle?: ReactNode;
  focusSlot?: ReactNode;
  sortSlot?: ReactNode;
  /** Non-default box state (#786/F3): the closed chip must not hide that the list is narrower
   *  than reality — it wears a dot. */
  filtered?: boolean;
}) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);

  if (isDesktop) {
    return (
      <div className="mb-2 flex items-center justify-end gap-1">
        {statusSlot && <div className="mr-auto">{statusSlot}</div>}
        {rowsToggle}
        {focusSlot}
        {sortSlot}
      </div>
    );
  }

  const hasFilters = Boolean(statusSlot || rowsToggle || sortSlot);
  return (
    <div className="mb-2 space-y-2">
      <div className="flex items-center justify-end gap-1">
        {hasFilters && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={filtered ? t('list.filtersActiveAria') : t('list.filters')}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              'flex items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent',
              open ? 'bg-accent text-foreground' : 'text-foreground',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('list.filters')}
            {filtered && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />}
          </button>
        )}
        {focusSlot}
      </div>
      <div className={cn('space-y-2 rounded-md border border-border bg-card p-2', !open && 'hidden')}>
        {statusSlot}
        {(rowsToggle || sortSlot) && (
          <div className="flex items-center gap-1">
            {rowsToggle}
            {sortSlot}
          </div>
        )}
      </div>
    </div>
  );
}
