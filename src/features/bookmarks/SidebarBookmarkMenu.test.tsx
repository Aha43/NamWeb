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
    disabled,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <button role="menuitem" aria-label={ariaLabel} onClick={onClick} disabled={disabled}>
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

  it('shows a stale bookmark greyed (not navigable) with a remove \u2715 (#594)', () => {
    const dispatch = vi.fn();
    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ document: doc([staleBm]), dispatch } as unknown as UseWorkspace}>
          <SidebarBookmarkMenu kind="project" />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );
    // The menu renders for the stale-only case — that's the point: see it, remove it.
    expect(screen.getByRole('button', { name: 'Project bookmarks' })).toBeInTheDocument();
    const row = screen.getByRole('menuitem', { name: /Old plans/ });
    expect(row).toBeDisabled(); // greyed, not navigable
    expect(screen.getByText('(no longer exists)')).toBeInTheDocument();
    // No "\u2026" browse for a gone project.
    expect(screen.queryByRole('menuitem', { name: 'Browse from Old plans' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove bookmark: Old plans' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'removeBookmark', id: 'b2' });
  });

  it('lists project bookmarks (stale greyed), navigates on live ones, and offers remove (#594)', () => {
    renderMenu('project', [projectBm, staleBm, contextBm]);
    expect(screen.getByRole('button', { name: 'Project bookmarks' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Old plans/ })).toBeDisabled(); // stale: shown, greyed
    expect(screen.queryByText('#home')).not.toBeInTheDocument(); // other kind
    expect(screen.getByRole('button', { name: 'Remove bookmark: Vacation' })).toBeInTheDocument(); // live rows too
    fireEvent.click(screen.getByRole('menuitem', { name: 'Vacation' }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1');
  });

  it("move up/down reorders within the kind, leaving other kinds' slots untouched (#636)", () => {
    const secondProjectBm: Bookmark = { id: 'b4', label: 'Cabin', kind: 'project', projectId: 'p1', color: '#3b82f6' };
    const dispatch = vi.fn();
    // Stored mixed order: [context b3, project b1, project b4] — the menu shows only b1, b4.
    render(
      <MemoryRouter>
        <WorkspaceContext.Provider
          value={{ document: doc([contextBm, projectBm, secondProjectBm]), dispatch } as unknown as UseWorkspace}
        >
          <SidebarBookmarkMenu kind="project" />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );
    // Ends are disabled within the visible (kind-filtered) list.
    expect(screen.getByRole('button', { name: 'Move Vacation up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Cabin down' })).toBeDisabled();
    // Moving Cabin up swaps the two project slots; the context bookmark keeps its slot.
    fireEvent.click(screen.getByRole('button', { name: 'Move Cabin up' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'reorderBookmarks', order: ['b3', 'b4', 'b1'] });
  });

  it('the pencil opens a rename dialog — prefilled, empty-guarded, dispatching renameBookmark (#732)', () => {
    const dispatch = vi.fn();
    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ document: doc([projectBm]), dispatch } as unknown as UseWorkspace}>
          <SidebarBookmarkMenu kind="project" />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename bookmark: Vacation' }));
    const input = screen.getByLabelText('Name');
    expect(input).toHaveValue('Vacation'); // prefilled with the current label

    // Empty (whitespace) can't be saved.
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    // "Use project name" pulls the live project title back in.
    fireEvent.click(screen.getByRole('button', { name: 'Use project name' }));
    expect(input).toHaveValue('Vacation');

    fireEvent.change(input, { target: { value: 'Vacation (Japan)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'renameBookmark', id: 'b1', label: 'Vacation (Japan)' });
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument(); // dialog closed
  });

  it('⌘/Ctrl+Enter commits the rename dialog like Save (#746)', () => {
    const dispatch = vi.fn();
    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ document: doc([projectBm]), dispatch } as unknown as UseWorkspace}>
          <SidebarBookmarkMenu kind="project" />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename bookmark: Vacation' }));
    const input = screen.getByLabelText('Name');
    fireEvent.change(input, { target: { value: 'Vacation (Japan)' } });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'renameBookmark', id: 'b1', label: 'Vacation (Japan)' });
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument(); // closed
  });

  it('a context bookmark renames too, but has no "Use project name" (#732)', () => {
    const dispatch = vi.fn();
    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ document: doc([contextBm]), dispatch } as unknown as UseWorkspace}>
          <SidebarBookmarkMenu kind="tagFilter" />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename bookmark: #home' }));
    expect(screen.queryByRole('button', { name: 'Use project name' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Economy of trip to Japan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'renameBookmark', id: 'b3', label: 'Economy of trip to Japan' });
  });

  it('a context bookmark navigates with tags + nextOnly encoded', () => {
    renderMenu('tagFilter', [projectBm, contextBm]);
    fireEvent.click(screen.getByRole('menuitem', { name: '#home' }));
    expect(navigate).toHaveBeenCalledWith('/tags?tags=home&next=1&bm=b3');
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
