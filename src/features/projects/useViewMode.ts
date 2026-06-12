import { useCallback, useEffect, useState } from 'react';

/** Workbench view mode: list (sections) / heat-map (cards) / column (Kanban). */
export type ViewMode = 'list' | 'heatmap' | 'column';

const KEY = (projectId: string) => `namweb.viewmode.${projectId}`;
const MODES: ViewMode[] = ['list', 'heatmap', 'column'];

function read(projectId: string): ViewMode {
  try {
    const stored = localStorage.getItem(KEY(projectId));
    if (stored && (MODES as string[]).includes(stored)) return stored as ViewMode;
  } catch {
    // localStorage unavailable — start in list mode.
  }
  return 'list';
}

/** Per-project workbench view mode, persisted to localStorage (mirrors `useSortMode`). */
export function useViewMode(projectId: string): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => read(projectId));

  // Re-read when navigating to a different project (the component instance is reused).
  useEffect(() => setMode(read(projectId)), [projectId]);

  const set = useCallback(
    (next: ViewMode) => {
      setMode(next);
      try {
        localStorage.setItem(KEY(projectId), next);
      } catch {
        // best-effort persistence
      }
    },
    [projectId],
  );

  return [mode, set];
}
