import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace } from '@/store/useWorkspace';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { ActionEditorProvider } from './ActionEditorProvider';
import { useActionEditor } from './action-editor-context';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function doc(nodes: Record<string, NamNode>): WorkspaceDocument {
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: { root: node('root', { childIds: Object.keys(nodes) }), ...nodes },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

function OpenButton({ id }: { id: string }) {
  const { openEditor } = useActionEditor();
  return <button onClick={() => openEditor(id)}>open {id}</button>;
}

function renderProvider(document: WorkspaceDocument) {
  const value = { document, dispatch: vi.fn() } as unknown as UseWorkspace;
  const view = render(
    <WorkspaceContext.Provider value={value}>
      <ActionEditorProvider>
        <OpenButton id="a" />
      </ActionEditorProvider>
    </WorkspaceContext.Provider>,
  );
  const rerenderWith = (next: WorkspaceDocument) =>
    view.rerender(
      <WorkspaceContext.Provider value={{ document: next, dispatch: vi.fn() } as unknown as UseWorkspace}>
        <ActionEditorProvider>
          <OpenButton id="a" />
        </ActionEditorProvider>
      </WorkspaceContext.Provider>,
    );
  return { rerenderWith };
}

describe('ActionEditorProvider', () => {
  it('opens the dialog for the requested node', () => {
    renderProvider(doc({ a: node('a', { title: 'Buy milk' }) }));
    fireEvent.click(screen.getByText('open a'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Buy milk');
  });

  it('clears the editing id when the node vanishes, so a restored id cannot reopen the dialog (#614)', () => {
    const { rerenderWith } = renderProvider(doc({ a: node('a', { title: 'Buy milk' }) }));
    fireEvent.click(screen.getByText('open a'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // The node is deleted out from under the open dialog (another surface / sync pull).
    rerenderWith(doc({}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The same id comes back (undo, conflict replay) — the dialog must NOT pop back open.
    rerenderWith(doc({ a: node('a', { title: 'Buy milk' }) }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
