import type { NamNode } from '@/domain/types';

/** none = document order; fifo = oldest first; lifo = newest first. */
export type SortMode = 'none' | 'fifo' | 'lifo';

export const NEXT_SORT_MODE: Record<SortMode, SortMode> = {
  none: 'fifo',
  fifo: 'lifo',
  lifo: 'none',
};

// i18n keys — the SortButton translates these at render (see src/locales, sort.*).
export const SORT_LABEL: Record<SortMode, string> = {
  none: 'sort.none',
  fifo: 'sort.fifo',
  lifo: 'sort.lifo',
};

/** Sort by creation time (ISO strings sort chronologically), falling back to updatedAt. */
export function sortNodes(nodes: NamNode[], mode: SortMode): NamNode[] {
  if (mode === 'none') return nodes;
  const key = (n: NamNode) => n.createdAt ?? n.updatedAt ?? '';
  const sorted = [...nodes].sort((a, b) => key(a).localeCompare(key(b)));
  return mode === 'fifo' ? sorted : sorted.reverse();
}

/**
 * Sort by due date, soonest first; undated items keep to the end. Dates are ISO `YYYY-MM-DD`
 * strings, which sort chronologically as plain text. A stable sort (V8) preserves the incoming
 * (manual) order among items that share a due date+time — and among the undated tail. Used by the
 * workbench's "by due" toggle (the calendar-board enabler, #437). Works on anything carrying a
 * `dueAt` (nodes and action rows alike); never mutates the input.
 *
 * Within a shared date, an optional `dueTime` (`"HH:MM"`) breaks the tie soonest-first; items with no
 * time keep to the front of that day (all-day before scheduled), then manual order among equals (#493).
 */
export function sortByDue<T extends { dueAt: string | null; dueTime?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.dueAt !== b.dueAt) {
      if (!a.dueAt) return 1; // undated → after everything dated
      if (!b.dueAt) return -1;
      return a.dueAt.localeCompare(b.dueAt);
    }
    if (!a.dueAt) return 0; // both undated → keep manual order
    // Same date — order by time of day; missing time sorts before any time.
    return (a.dueTime ?? '').localeCompare(b.dueTime ?? '');
  });
}
