import type { ReactNode } from 'react';
import { useWorkspace } from './useWorkspace';
import { WorkspaceContext } from './workspace-context';

/** Calls the workspace hook once and provides it to the routed tree. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspace();
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}
