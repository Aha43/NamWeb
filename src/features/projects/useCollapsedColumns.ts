import { useCallback, useEffect, useState } from 'react';

const KEY = (projectId: string) => `namweb.collapsed.${projectId}`;

function read(projectId: string): Set<string> {
  try {
    const stored = localStorage.getItem(KEY(projectId));
    if (stored) return new Set(JSON.parse(stored) as string[]);
  } catch {
    // localStorage unavailable / malformed — nothing collapsed.
  }
  return new Set();
}

/** Per-project set of collapsed column ids, persisted to localStorage (mirrors desktop
 *  `AppSettings.collapsedColumns`). Returns the set and a toggle. */
export function useCollapsedColumns(projectId: string): [Set<string>, (id: string) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => read(projectId));

  // Re-read when navigating to a different project (the component instance is reused).
  useEffect(() => setCollapsed(read(projectId)), [projectId]);

  const toggle = useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(KEY(projectId), JSON.stringify([...next]));
        } catch {
          // best-effort persistence
        }
        return next;
      });
    },
    [projectId],
  );

  return [collapsed, toggle];
}
