import { useCallback, useState } from 'react';
import { NEXT_SORT_MODE, type SortMode } from './sort';

const KEY = (list: string) => `namweb.sort.${list}`;
const MODES: SortMode[] = ['none', 'fifo', 'lifo'];

function read(list: string): SortMode {
  try {
    const stored = localStorage.getItem(KEY(list));
    if (stored && (MODES as string[]).includes(stored)) return stored as SortMode;
  } catch {
    // localStorage unavailable — start unsorted.
  }
  return 'none';
}

/** Per-list sort mode, persisted to localStorage; `cycle` advances none→fifo→lifo→none. */
export function useSortMode(list: string): [SortMode, () => void] {
  const [mode, setMode] = useState<SortMode>(() => read(list));
  const cycle = useCallback(() => {
    setMode((current) => {
      const next = NEXT_SORT_MODE[current];
      try {
        localStorage.setItem(KEY(list), next);
      } catch {
        // best-effort persistence
      }
      return next;
    });
  }, [list]);
  return [mode, cycle];
}
