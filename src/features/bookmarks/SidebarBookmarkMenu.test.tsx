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
  DropdownMenuItem: ({
    children,
    onClick,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    onClick?: () => void;
    'aria-label'?: string;
  }) => (
    <button role="menuitem" aria-label={ariaLabel} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
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
      root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
      inbox: node('inbox'),
      projects: node('projects', { childIds: ['p1'] }),
      actions: node('actions'),
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

  it('a row\'s "…" opens the picker already at that project — Open navigates (#595)', () => {
    renderMenu('project', [projectBm]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Browse from Vacation' }));
    // The Finder-style picker in open mode, pre-navigated: the bookmark is already the selection,
    // so Open is immediately available and confirms to it.
    expect(screen.getByText('Open project')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1');
  });

  it('the context menu has no "…" browse items (#595 is a project affair)', () => {
    renderMenu('tagFilter', [contextBm]);
    expect(screen.queryByRole('menuitem', { name: /Browse from/ })).not.toBeInTheDocument();
  });
});
