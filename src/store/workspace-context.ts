import { createContext, useContext } from 'react';
import type { UseWorkspace } from './useWorkspace';

export const WorkspaceContext = createContext<UseWorkspace | undefined>(undefined);

export function useWorkspaceContext(): UseWorkspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  return ctx;
}
