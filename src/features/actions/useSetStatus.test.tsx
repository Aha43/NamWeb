import { render, renderHook, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace } from '@/store/useWorkspace';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import { useSetStatus, useSetStatuses } from './useSetStatus';

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
    root: node('root', { childIds: ['a', 'b', 'wip'] }),
    a: node('a', { status: 'NEXT', statusChangedAt: '2026-01-01T00:00:00.000Z' }),
    b: node('b', { status: 'NEXT' }),
    wip: node('wip', { status: 'NEXT', tags: ['in progress'] }),
  },
  registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
};

function wrapper(dispatch: ReturnType<typeof vi.fn>) {
  const value = { document: doc, dispatch } as unknown as UseWorkspace;
  return ({ children }: { children: ReactNode }) => (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

describe('useSetStatus', () => {
  it('dispatches setStatus for a real change', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useSetStatus(), { wrapper: wrapper(dispatch) });
    result.current('a', 'DONE');
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setStatus', id: 'a', status: 'DONE' }),
    );
  });

  it('no-ops for a missing node and for an unchanged status', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useSetStatus(), { wrapper: wrapper(dispatch) });
    result.current('ghost', 'DONE');
    result.current('a', 'NEXT'); // already NEXT
    expect(dispatch).not.toHaveBeenCalled();
  });
});

function Harness({ ids, status, many = false }: { ids: string[]; status: NamNode['status']; many?: boolean }) {
  const set = useSetStatus();
  const setMany = useSetStatuses();
  return <button onClick={() => (many ? setMany(ids, status) : set(ids[0], status))}>go</button>;
}

function renderHarness(dispatch: ReturnType<typeof vi.fn>, ids: string[], status: NamNode['status'], many = false) {
  const value = { document: doc, dispatch } as unknown as UseWorkspace;
  render(
    <WorkspaceContext.Provider value={value}>
      <ToastProvider>
        <Harness ids={ids} status={status} many={many} />
      </ToastProvider>
    </WorkspaceContext.Provider>,
  );
}

describe('useSetStatus — Undo toast (#567)', () => {
  it('shows an Undo toast that restores the previous status and statusChangedAt', () => {
    const dispatch = vi.fn();
    renderHarness(dispatch, ['a'], 'DONE');
    fireEvent.click(screen.getByText('go'));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setStatus', id: 'a', status: 'DONE' }),
    );
    expect(screen.getByText('Marked "a" as Done')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'setStatus',
        id: 'a',
        status: 'NEXT',
        statusChangedAt: '2026-01-01T00:00:00.000Z',
        // Guard: a stale Undo (node re-statused after this toast) no-ops in the applier (#573).
        expectedStatus: 'DONE',
      }),
    );
    expect(screen.queryByText('Marked "a" as Done')).not.toBeInTheDocument(); // dismissed after undo
  });

  it('bulk change shows one grouped toast restoring each node', () => {
    const dispatch = vi.fn();
    renderHarness(dispatch, ['a', 'b'], 'BACKLOG', true);
    fireEvent.click(screen.getByText('go'));

    expect(screen.getByText('Marked 2 actions as Backlog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    const restores = dispatch.mock.calls.filter(
      ([i]) => i.type === 'setStatus' && i.status === 'NEXT',
    );
    expect(restores).toHaveLength(2);
  });

  it("Undo of an accidental Done restores the in-progress mark; a plain node's doesn't (#724)", () => {
    const dispatch = vi.fn();
    renderHarness(dispatch, ['wip'], 'DONE');
    fireEvent.click(screen.getByText('go'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setStatus', id: 'wip', status: 'NEXT', restoreInProgress: true }),
    );

    const dispatch2 = vi.fn();
    renderHarness(dispatch2, ['a'], 'DONE');
    fireEvent.click(screen.getAllByText('go')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(dispatch2).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setStatus', id: 'a', status: 'NEXT', restoreInProgress: false }),
    );
  });

  it('bulk no-ops entirely when every node already has the target status', () => {
    const dispatch = vi.fn();
    renderHarness(dispatch, ['a', 'b'], 'NEXT', true); // both already NEXT
    fireEvent.click(screen.getByText('go'));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });
});
