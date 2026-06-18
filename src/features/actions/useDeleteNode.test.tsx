import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace } from '@/store/useWorkspace';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { useDeleteNode } from './useDeleteNode';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

const doc: WorkspaceDocument = {
  formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
  nodes: {
    root: node('root', { childIds: ['a', 'p'] }),
    a: node('a'),
    p: node('p', { project: true, childIds: ['c'] }),
    c: node('c'),
  },
  registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
};

function wrapper(dispatch: ReturnType<typeof vi.fn>) {
  const value = { document: doc, dispatch } as unknown as UseWorkspace;
  return ({ children }: { children: ReactNode }) => (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

describe('useDeleteNode', () => {
  it('deletes a leaf via deleteLeaf (no confirm — callers confirm)', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDeleteNode(), { wrapper: wrapper(dispatch) });
    result.current('a');
    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteLeaf', id: 'a' });
  });

  it('deletes a subtree via deleteRecursive for a parent', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDeleteNode(), { wrapper: wrapper(dispatch) });
    result.current('p');
    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteRecursive', id: 'p' });
  });

  it('no-ops for a missing node', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDeleteNode(), { wrapper: wrapper(dispatch) });
    result.current('ghost');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
