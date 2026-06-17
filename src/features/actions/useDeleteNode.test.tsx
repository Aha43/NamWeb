import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => vi.restoreAllMocks());

describe('useDeleteNode', () => {
  it('deletes a leaf via deleteLeaf after confirm', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDeleteNode(), { wrapper: wrapper(dispatch) });
    expect(result.current('a')).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteLeaf', id: 'a' });
  });

  it('deletes a subtree via deleteRecursive for a parent', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDeleteNode(), { wrapper: wrapper(dispatch) });
    result.current('p');
    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteRecursive', id: 'p' });
  });

  it('does nothing when the confirm is dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDeleteNode(), { wrapper: wrapper(dispatch) });
    expect(result.current('a')).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
