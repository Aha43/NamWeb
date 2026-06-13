import { useCallback, useEffect, useState } from 'react';

const KEY = (projectId: string) => `namweb.addpanel.collapsed.${projectId}`;

function read(projectId: string): boolean {
  try {
    return localStorage.getItem(KEY(projectId)) === 'true';
  } catch {
    // localStorage unavailable — default to expanded.
    return false;
  }
}

/** Per-project collapsed state for the workbench "Add to project" panel, persisted to
 *  localStorage (mirrors `useViewMode` / `useCollapsedColumns`). Defaults to expanded. */
export function useCollapsedAddPanel(projectId: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => read(projectId));

  // Re-read when navigating to a different project (the component instance is reused).
  useEffect(() => setCollapsed(read(projectId)), [projectId]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY(projectId), String(next));
      } catch {
        // best-effort persistence
      }
      return next;
    });
  }, [projectId]);

  return [collapsed, toggle];
}
