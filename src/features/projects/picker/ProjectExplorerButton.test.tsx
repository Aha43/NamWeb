import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { ActionEditorContext } from '@/features/actions/action-editor-context';
import { ProjectExplorerButton } from './ProjectExplorerButton';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

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
    inbox: node('inbox'),
    projects: node('projects', { childIds: ['p1'] }),
    actions: node('actions', { childIds: ['a1'] }),
    a1: node('a1', { title: 'Buy tickets' }),
    p1: node('p1', { title: 'Vacation', project: true }),
  },
  registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  // No bookmarks — the explorer is independent of them (#595).
};

describe('ProjectExplorerButton (#595/#657)', () => {
  function renderExplorer(openEditor = vi.fn()) {
    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ document: doc, dispatch: vi.fn() } as unknown as UseWorkspace}>
          <ActionEditorContext.Provider value={{ openEditor }}>
            <ProjectExplorerButton />
          </ActionEditorContext.Provider>
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Project explorer' }));
    return openEditor;
  }

  it('opens the picker from the top even with zero bookmarks; opening a project navigates', () => {
    renderExplorer();
    expect(screen.getByText('Open project or action')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vacation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1');
  });

  it('opening an action opens its editor instead of navigating (#657)', () => {
    const openEditor = renderExplorer();
    // The free action is browsable at the root in both-mode.
    fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(openEditor).toHaveBeenCalledWith('a1');
    expect(navigate).not.toHaveBeenCalledWith('/projects/a1');
  });
});
