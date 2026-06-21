import { useCallback, useEffect, useState } from 'react';

const KEY = (projectId: string) => `namweb.column.widths.${projectId}`;

/** Default column width (px) — matches the old fixed `w-64`. */
export const DEFAULT_COLUMN_WIDTH = 256;
const MIN_WIDTH = 200;
const MAX_WIDTH = 640;

const clamp = (w: number) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)));

function read(projectId: string): Record<string, number> {
  try {
    const stored = localStorage.getItem(KEY(projectId));
    if (stored) return JSON.parse(stored) as Record<string, number>;
  } catch {
    // localStorage unavailable / malformed — fall back to defaults.
  }
  return {};
}

/**
 * Per-project, per-column widths for the Column (Kanban) view, persisted to localStorage (mirrors
 * the resizable sidebar). A column with no stored width uses {@link DEFAULT_COLUMN_WIDTH}; widths are
 * clamped to a sane range. `resetWidth` removes the override (back to default).
 */
export function useColumnWidths(projectId: string): {
  widths: Record<string, number>;
  setWidth: (columnId: string, width: number) => void;
  resetWidth: (columnId: string) => void;
} {
  const [widths, setWidths] = useState<Record<string, number>>(() => read(projectId));

  // Re-read when navigating to a different project (the component instance is reused).
  useEffect(() => setWidths(read(projectId)), [projectId]);

  const persist = useCallback(
    (next: Record<string, number>) => {
      try {
        localStorage.setItem(KEY(projectId), JSON.stringify(next));
      } catch {
        // best-effort persistence
      }
    },
    [projectId],
  );

  const setWidth = useCallback(
    (columnId: string, width: number) => {
      setWidths((prev) => {
        const next = { ...prev, [columnId]: clamp(width) };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetWidth = useCallback(
    (columnId: string) => {
      setWidths((prev) => {
        const next = { ...prev };
        delete next[columnId];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { widths, setWidth, resetWidth };
}
