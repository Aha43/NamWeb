import { renderHook, render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace } from '@/store/useWorkspace';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import { useDeleteNode, useDeleteNodes } from './useDeleteNode';

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

function Harness({ ids, many = false }: { ids: string[]; many?: boolean }) {
  const del = useDeleteNode();
  const delMany = useDeleteNodes();
  return <button onClick={() => (many ? delMany(ids) : del(ids[0]))}>go</button>;
}

function renderHarness(dispatch: ReturnType<typeof vi.fn>, ids: string[], many = false) {
  const value = { document: doc, dispatch } as unknown as UseWorkspace;
  render(
    <WorkspaceContext.Provider value={value}>
      <ToastProvider>
        <Harness ids={ids} many={many} />
      </ToastProvider>
    </WorkspaceContext.Provider>,
  );
}

describe('useDeleteNode — Undo toast', () => {
  it('shows an Undo toast that dispatches restoreNodes', () => {
    const dispatch = vi.fn();
    renderHarness(dispatch, ['a']);
    fireEvent.click(screen.getByText('go'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteLeaf', id: 'a' });
    expect(screen.getByText('Deleted "a"')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'restoreNodes' }));
    expect(screen.queryByText('Deleted "a"')).not.toBeInTheDocument(); // dismissed after undo
  });

  it('bulk delete shows one "Deleted N items" toast restoring all', () => {
    const dispatch = vi.fn();
    renderHarness(dispatch, ['a', 'c'], true);
    fireEvent.click(screen.getByText('go'));

    expect(screen.getByText('Deleted 2 items')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    const restores = dispatch.mock.calls.filter(([i]) => i.type === 'restoreNodes');
    expect(restores).toHaveLength(2);
  });
});
