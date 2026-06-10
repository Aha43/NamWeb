import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { AppRoutes } from './AppRoutes';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

function document(): WorkspaceDocument {
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox',
    projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: {
      root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
      inbox: node('inbox', { childIds: ['cap'] }),
      projects: node('projects'),
      actions: node('actions', { childIds: ['nxt', 'bk'] }),
      cap: node('cap', { title: 'Capture me', status: 'BACKLOG' }),
      nxt: node('nxt', { title: 'Do this', status: 'NEXT' }),
      bk: node('bk', { title: 'Later thing', status: 'BACKLOG' }),
    },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

function workspace(overrides: Partial<UseWorkspace> = {}): UseWorkspace {
  return {
    document: document(), loading: false, error: null, noRemote: false, notice: null,
    clearNotice: vi.fn(), retry: vi.fn(), dispatch: vi.fn(), ...overrides,
  };
}

function renderAt(path: string, overrides: Partial<UseWorkspace> = {}) {
  const ws = workspace(overrides);
  render(
    <ThemeProvider>
      <WorkspaceContext.Provider value={ws}>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </ThemeProvider>,
  );
  return ws;
}

describe('routing', () => {
  it('renders the inbox at /inbox', () => {
    renderAt('/inbox');
    expect(screen.getByLabelText('Quick add')).toBeInTheDocument();
    expect(screen.getByText('Capture me')).toBeInTheDocument();
  });

  it('renders next actions at /next', () => {
    renderAt('/next');
    expect(screen.getByText('Do this')).toBeInTheDocument();
  });

  it('renders the backlog at /backlog', () => {
    renderAt('/backlog');
    expect(screen.getByText('Later thing')).toBeInTheDocument();
  });

  it('redirects the index route to /inbox', () => {
    renderAt('/');
    expect(screen.getByLabelText('Quick add')).toBeInTheDocument();
  });

  it('shows a not-found for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('shows the loading state instead of the routed page', () => {
    renderAt('/inbox', { loading: true });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByLabelText('Quick add')).not.toBeInTheDocument();
  });

  it('shows a dismissible sync notice across routes', () => {
    const clearNotice = vi.fn();
    renderAt('/next', { notice: 'Reloaded — synced from another device', clearNotice });
    expect(screen.getByRole('status')).toHaveTextContent('Reloaded');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(clearNotice).toHaveBeenCalledOnce();
  });
});
