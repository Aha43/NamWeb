import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { AuthUserContext } from '@/auth/auth-context';

const REAL_USER = { id: 'u1', aud: 'authenticated' } as unknown as User;
const DEMO_USER = { id: 'demo', aud: 'demo' } as unknown as User;

const service = { fetchOwnerShares: vi.fn() };
vi.mock('./shares', async (orig) => ({
  ...(await orig<typeof import('./shares')>()),
  fetchOwnerShares: (...a: unknown[]) => service.fetchOwnerShares(...a),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import { SharedProjectsPage } from './SharedProjectsPage';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function docWith(...projects: NamNode[]): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {
    root: node('root'), inbox: node('inbox'), projects: node('projects'), actions: node('actions'),
  };
  for (const p of projects) nodes[p.id] = p;
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

function renderPage(doc: WorkspaceDocument, user: User = REAL_USER) {
  render(
    <AuthUserContext.Provider value={user}>
      <WorkspaceContext.Provider value={{ document: doc } as unknown as UseWorkspace}>
        <MemoryRouter>
          <SharedProjectsPage />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </AuthUserContext.Provider>,
  );
}

beforeEach(() => {
  service.fetchOwnerShares.mockReset();
  navigate.mockReset();
});

describe('SharedProjectsPage (#857)', () => {
  it('lists the owner\'s shared projects (joined to the workspace doc), sorted by title', async () => {
    service.fetchOwnerShares.mockResolvedValue([
      { token: 't1', share_id: 's1', project_id: 'zoo' },
      { token: 't2', share_id: 's2', project_id: 'apiary' },
    ]);
    renderPage(docWith(node('zoo', { project: true, title: 'Zoo trip' }), node('apiary', { project: true, title: 'Apiary' })));
    await waitFor(() => expect(screen.getByText('Apiary')).toBeInTheDocument());
    const titles = screen.getAllByText(/Apiary|Zoo trip/).map((el) => el.textContent);
    expect(titles).toEqual(['Apiary', 'Zoo trip']); // alphabetical
  });

  it('opens a project into its workbench on click', async () => {
    service.fetchOwnerShares.mockResolvedValue([{ token: 't1', share_id: 's1', project_id: 'trip' }]);
    renderPage(docWith(node('trip', { project: true, title: 'Asia trip' })));
    await waitFor(() => expect(screen.getByText('Asia trip')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Open Asia trip' }));
    expect(navigate).toHaveBeenCalledWith('/projects/trip');
  });

  it('drops a share whose project is not in this workspace (deleted / other device)', async () => {
    service.fetchOwnerShares.mockResolvedValue([
      { token: 't1', share_id: 's1', project_id: 'here' },
      { token: 't2', share_id: 's2', project_id: 'gone' },
    ]);
    renderPage(docWith(node('here', { project: true, title: 'Here project' })));
    await waitFor(() => expect(screen.getByText('Here project')).toBeInTheDocument());
    expect(screen.queryByText('gone')).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing is shared', async () => {
    service.fetchOwnerShares.mockResolvedValue([]);
    renderPage(docWith());
    await waitFor(() => expect(screen.getByText('No shared projects yet')).toBeInTheDocument());
  });

  it('shows an empty state (not a crash) when the shares fetch fails', async () => {
    service.fetchOwnerShares.mockRejectedValue(new Error('offline'));
    renderPage(docWith());
    await waitFor(() => expect(screen.getByText('No shared projects yet')).toBeInTheDocument());
  });

  it('never hits the backend in the demo — empty state, no fetch (offline invariant)', async () => {
    renderPage(docWith(), DEMO_USER);
    await waitFor(() => expect(screen.getByText('No shared projects yet')).toBeInTheDocument());
    expect(service.fetchOwnerShares).not.toHaveBeenCalled();
  });
});
