import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace } from '@/store/useWorkspace';
import { InProgressToggle } from './InProgressToggle';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function renderToggle(tags: string[]) {
  const dispatch = vi.fn();
  const document = {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: { a: node('a', { title: 'Buy milk', tags }) },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  } as WorkspaceDocument;
  render(
    <WorkspaceContext.Provider value={{ document, dispatch } as unknown as UseWorkspace}>
      <InProgressToggle id="a" title="Buy milk" />
    </WorkspaceContext.Provider>,
  );
  return dispatch;
}

describe('InProgressToggle (#651)', () => {
  it('marks an action as in progress (appends the system tag)', () => {
    const dispatch = renderToggle(['home']);
    const button = screen.getByRole('button', { name: 'Working on it: Buy milk' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'updateTags', id: 'a', tags: ['home', 'in progress'] }),
    );
  });

  it('clears the mark when already in progress', () => {
    const dispatch = renderToggle(['in progress', 'home']);
    const button = screen.getByRole('button', { name: 'Working on it: Buy milk' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'updateTags', id: 'a', tags: ['home'] }),
    );
  });

  it('treats a NamDesktop-cased variant ("In Progress") as on, and clears it (#654)', () => {
    const dispatch = renderToggle(['In Progress', 'home']);
    const button = screen.getByRole('button', { name: 'Working on it: Buy milk' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'updateTags', id: 'a', tags: ['home'] }),
    );
  });

  it('renders nothing without a workspace provider (presentational hosts)', () => {
    const { container } = render(<InProgressToggle id="a" title="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
