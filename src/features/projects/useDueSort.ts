import { useCallback, useEffect, useState } from 'react';

const KEY = (projectId: string) => `namweb.duesort.${projectId}`;

function read(projectId: string): boolean {
  try {
    return localStorage.getItem(KEY(projectId)) === 'true';
  } catch {
    // localStorage unavailable — default to manual order.
    return false;
  }
}

/**
 * Per-project "sort actions by due date" toggle for the workbench (list + column views), persisted
 * to localStorage like the view mode and collapsed state (#437). Off = manual (childIds) order; on =
 * soonest-due first, undated last. Persisted (not session) so a project you keep date-ordered stays
 * that way across reloads, matching the rest of the per-project workbench prefs.
 */
export function useDueSort(projectId: string): [boolean, () => void] {
  const [sorted, setSorted] = useState<boolean>(() => read(projectId));

  // Re-read when navigating to a different project (the component instance is reused).
  useEffect(() => setSorted(read(projectId)), [projectId]);

  const toggle = useCallback(() => {
    setSorted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY(projectId), String(next));
      } catch {
        // best-effort persistence
      }
      return next;
    });
  }, [projectId]);

  return [sorted, toggle];
}
