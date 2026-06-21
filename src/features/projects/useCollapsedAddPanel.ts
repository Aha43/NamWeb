import { useCallback, useEffect, useState } from 'react';

const KEY = (projectId: string) => `namweb.addpanel.collapsed.${projectId}`;

function read(projectId: string): boolean {
  try {
    const stored = localStorage.getItem(KEY(projectId));
    // Default collapsed on first open (clean project landing); a stored value is authoritative.
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

/** Per-project collapsed state for the workbench "Add to project" panel, persisted to
 *  localStorage (mirrors `useViewMode` / `useCollapsedColumns`). Defaults to collapsed. */
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
