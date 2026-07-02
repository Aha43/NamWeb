import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Bookmark, NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

// Radix's dropdown doesn't open under jsdom (portal + pointer events); render the
// items inline so the navigation wiring is what's under test.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button role="menuitem" onClick={onClick}>
      {children}
    </button>
  ),
}));

import { SidebarBookmarkMenu } from './SidebarBookmarkMenu';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function doc(bookmarks: Bookmark[]): WorkspaceDocument {
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: {
      root: node('root', { childIds: ['p1'] }),
      p1: node('p1', { title: 'Vacation', project: true }),
    },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
    bookmarks,
  };
}

const projectBm: Bookmark = { id: 'b1', label: 'Vacation', kind: 'project', projectId: 'p1', color: '#ef4444' };
const staleBm: Bookmark = { id: 'b2', label: 'Old plans', kind: 'project', projectId: 'gone', color: '#f59e0b' };
const contextBm: Bookmark = { id: 'b3', label: '#home', kind: 'tagFilter', tags: ['home'], nextOnly: true, color: '#10b981' };

function renderMenu(kind: 'project' | 'tagFilter', bookmarks: Bookmark[]) {
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={{ document: doc(bookmarks), dispatch: vi.fn() } as unknown as UseWorkspace}>
        <SidebarBookmarkMenu kind={kind} />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
}

describe('SidebarBookmarkMenu (#588)', () => {
  it('renders nothing when there are no bookmarks of its kind', () => {
    renderMenu('project', [contextBm]); // only the other kind
    expect(screen.queryByRole('button', { name: 'Project bookmarks' })).not.toBeInTheDocument();
  });

  it('renders nothing when the only project bookmark is stale', () => {
    renderMenu('project', [staleBm]);
    expect(screen.queryByRole('button', { name: 'Project bookmarks' })).not.toBeInTheDocument();
  });

  it('lists live project bookmarks only, and navigates to the project', () => {
    renderMenu('project', [projectBm, staleBm, contextBm]);
    expect(screen.getByRole('button', { name: 'Project bookmarks' })).toBeInTheDocument();
    expect(screen.queryByText('Old plans')).not.toBeInTheDocument(); // stale filtered out
    expect(screen.queryByText('#home')).not.toBeInTheDocument(); // other kind
    fireEvent.click(screen.getByRole('menuitem', { name: 'Vacation' }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1');
  });

  it('a context bookmark navigates with tags + nextOnly encoded', () => {
    renderMenu('tagFilter', [projectBm, contextBm]);
    fireEvent.click(screen.getByRole('menuitem', { name: '#home' }));
    expect(navigate).toHaveBeenCalledWith('/tags?tags=home&next=1');
  });
});
