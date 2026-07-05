import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace } from '@/store/useWorkspace';
import { ProcessWizard } from './ProcessWizard';

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
    root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    inbox: node('inbox'), projects: node('projects'), actions: node('actions'),
  },
  registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
};

function renderDesktopWizard() {
  const onResolve = vi.fn();
  const onCancel = vi.fn();
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  render(
    <WorkspaceContext.Provider value={{ document: doc, dispatch: vi.fn() } as unknown as UseWorkspace}>
      <ProcessWizard count={2} projectTargets={[]} onResolve={onResolve} onCancel={onCancel} />
    </WorkspaceContext.Provider>,
  );
  return { onResolve, onCancel, restore: () => (window.matchMedia = original) };
}

describe('ProcessWizard', () => {
  it('⌘Enter picks the default destination ("" sentinel) and advances to the status step (#645)', () => {
    const { onResolve, restore } = renderDesktopWizard();
    try {
      // Destination step, default location preselected in the embedded columns.
      expect(screen.getByText('File selected items under…')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
      // Advanced — the status step is showing.
      expect(screen.getByText('What should they become?')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Backlog' }));
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onResolve).toHaveBeenCalledWith({ kind: 'action', status: 'BACKLOG', parentId: undefined });
    } finally {
      restore();
    }
  });
});
