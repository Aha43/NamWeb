import { createContext, useContext } from 'react';

export interface DeleteProjectContextValue {
  /** Open the advanced-delete dialog for a project (handles confirm, child disposition, undo). */
  requestDeleteProject: (projectId: string) => void;
}

export const DeleteProjectContext = createContext<DeleteProjectContextValue | null>(null);

/**
 * Falls back to a no-op when no provider is mounted, so pages/panels render in isolation (and in
 * tests) without wrapping. The real `DeleteProjectProvider` is mounted app-wide in production.
 */
export function useDeleteProject(): DeleteProjectContextValue {
  return useContext(DeleteProjectContext) ?? { requestDeleteProject: () => {} };
}
