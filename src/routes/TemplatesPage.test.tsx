import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

let ids = 0;
vi.mock('@/lib/local', async (orig) => ({
  ...(await orig<typeof import('@/lib/local')>()),
  newId: () => `id${++ids}`,
  nowIso: () => 'T',
}));

import { TemplatesPage } from './TemplatesPage';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function docWith(): WorkspaceDocument {
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: { root: node('root'), inbox: node('inbox'), projects: node('projects'), actions: node('actions') },
    registeredTags: [], savedViews: [], missionControls: [], templates: [
      { name: 'Reno', children: [{ id: 'orig', title: 'Plumbing', project: true, status: 'NEXT', tags: ['home'], children: [] }] },
    ], viewOrders: {},
  };
}

describe('TemplatesPage — create a project from a template (#864)', () => {
  it('dispatches seedProject wrapping the template as a new top-level project, then navigates into it', () => {
    ids = 0;
    const dispatch = vi.fn();
    render(
      <WorkspaceContext.Provider value={{ document: docWith(), dispatch } as unknown as UseWorkspace}>
        <MemoryRouter>
          <TemplatesPage />
        </MemoryRouter>
      </WorkspaceContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create a project from the Reno template' }));
    // First newId is the project; the clone gets the next. seedProject creates a project named after
    // the template, containing the cloned (rich) template structure.
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'seedProject',
        parentId: 'projects',
        nodes: [
          expect.objectContaining({
            id: 'id1',
            title: 'Reno',
            project: true,
            children: [expect.objectContaining({ title: 'Plumbing', project: true, status: 'NEXT', tags: ['home'] })],
          }),
        ],
      }),
    );
    expect(navigate).toHaveBeenCalledWith('/projects/id1');
  });
});
