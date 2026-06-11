import type { NamNode } from '@/domain/types';

/** none = document order; fifo = oldest first; lifo = newest first. */
export type SortMode = 'none' | 'fifo' | 'lifo';

export const NEXT_SORT_MODE: Record<SortMode, SortMode> = {
  none: 'fifo',
  fifo: 'lifo',
  lifo: 'none',
};

export const SORT_LABEL: Record<SortMode, string> = {
  none: 'Unsorted',
  fifo: 'Oldest',
  lifo: 'Newest',
};

/** Sort by creation time (ISO strings sort chronologically), falling back to updatedAt. */
export function sortNodes(nodes: NamNode[], mode: SortMode): NamNode[] {
  if (mode === 'none') return nodes;
  const key = (n: NamNode) => n.createdAt ?? n.updatedAt ?? '';
  const sorted = [...nodes].sort((a, b) => key(a).localeCompare(key(b)));
  return mode === 'fifo' ? sorted : sorted.reverse();
}
