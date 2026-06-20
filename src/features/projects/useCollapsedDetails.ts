import { useCallback, useEffect, useState } from 'react';

const KEY = (projectId: string) => `namweb.details.collapsed.${projectId}`;

function read(projectId: string): boolean {
  try {
    const stored = localStorage.getItem(KEY(projectId));
    // Default to collapsed (the panel is opt-in, unlike the Add panel).
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

function write(projectId: string, collapsed: boolean) {
  try {
    localStorage.setItem(KEY(projectId), String(collapsed));
  } catch {
    // best-effort persistence
  }
}

/** Per-project collapsed state for the workbench "Details" (edit project) panel, persisted to
 *  localStorage (mirrors `useCollapsedAddPanel`). Defaults to collapsed. The explicit setter lets
 *  the page force it open when the user arrives via an "edit details" action. */
export function useCollapsedDetails(projectId: string): [boolean, () => void, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => read(projectId));

  // Re-read when navigating to a different project (the component instance is reused).
  useEffect(() => setCollapsed(read(projectId)), [projectId]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      write(projectId, next);
      return next;
    });
  }, [projectId]);

  const set = useCallback(
    (next: boolean) => {
      write(projectId, next);
      setCollapsed(next);
    },
    [projectId],
  );

  return [collapsed, toggle, set];
}
