import { useCallback, useEffect, useState } from 'react';

/** Section keys for the List / Heat-map workbench views. */
export type WorkbenchSection = 'actions' | 'subprojects';

const KEY = (projectId: string) => `namweb.collapsed.sections.${projectId}`;

/** Default on first open (no stored value): both sections collapsed, for a clean project landing. */
const DEFAULT_COLLAPSED = (): Set<string> => new Set(['actions', 'subprojects']);

function read(projectId: string): Set<string> {
  try {
    const stored = localStorage.getItem(KEY(projectId));
    // A stored value (even '[]' = "I expanded both") is authoritative; only first-open defaults.
    if (stored === null) return DEFAULT_COLLAPSED();
    return new Set(JSON.parse(stored) as string[]);
  } catch {
    return DEFAULT_COLLAPSED();
  }
}

/** Per-project set of collapsed workbench sections (Actions / Sub-projects) for the List and
 *  Heat-map views, persisted to localStorage (mirrors `useCollapsedColumns`). */
export function useCollapsedSections(projectId: string): [Set<string>, (section: WorkbenchSection) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => read(projectId));

  // Re-read when navigating to a different project (the component instance is reused).
  useEffect(() => setCollapsed(read(projectId)), [projectId]);

  const toggle = useCallback(
    (section: WorkbenchSection) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(section)) next.delete(section);
        else next.add(section);
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
