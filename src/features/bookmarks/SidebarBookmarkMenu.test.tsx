import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Bookmark, NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';

const navigate = vi.fn();
vi.mock('react-router', async (orig) => ({
  ...(await orig<typeof import('react-router')>()),
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
// A leftover tag-filter bookmark from an old doc (#1107): the kind no longer exists in the type, so
// simulate the on-disk shape. It must be ignored everywhere, never rendered.
const legacyTagBm = { id: 'b3', label: '#home', kind: 'tagFilter', tags: ['home'], nextOnly: true, color: '#10b981' } as unknown as Bookmark;

function renderMenu(bookmarks: Bookmark[]) {
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={{ document: doc(bookmarks), dispatch: vi.fn() } as unknown as UseWorkspace}>
        <SidebarBookmarkMenu />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
}

describe('SidebarBookmarkMenu (#588)', () => {
  it('renders nothing when there are no project bookmarks (a leftover tag bookmark is ignored, #1107)', () => {
    renderMenu([legacyTagBm]);
    expect(screen.queryByRole('button', { name: 'Project bookmarks' })).not.toBeInTheDocument();
  });

  it('shows a stale bookmark greyed (not navigable) with a remove control (#594)', () => {
    const dispatch = vi.fn();
    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ document: doc([staleBm]), dispatch } as unknown as UseWorkspace}>
          <SidebarBookmarkMenu />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );
    // The menu renders for the stale-only case — that's the point: see it, remove it.
    expect(screen.getByRole('button', { name: 'Project bookmarks' })).toBeInTheDocument();
    const row = screen.getByRole('menuitem', { name: /Old plans/ });
    expect(row).toBeDisabled(); // greyed, not navigable
    expect(screen.getByText('(no longer exists)')).toBeInTheDocument();
    // No browse for a gone project.
    expect(screen.queryByRole('menuitem', { name: 'Browse from Old plans' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove bookmark: Old plans' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'removeBookmark', id: 'b2' });
  });

  it('lists project bookmarks (stale greyed), navigates on live ones, and offers remove (#594)', () => {
    renderMenu([projectBm, staleBm, legacyTagBm]);
    expect(screen.getByRole('button', { name: 'Project bookmarks' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Old plans/ })).toBeDisabled(); // stale: shown, greyed
    expect(screen.queryByText('#home')).not.toBeInTheDocument(); // leftover tag bookmark ignored
    expect(screen.getByRole('button', { name: 'Remove bookmark: Vacation' })).toBeInTheDocument(); // live rows too
    fireEvent.click(screen.getByRole('menuitem', { name: 'Vacation' }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1');
  });

  it('move up/down reorders the project bookmarks (#636)', () => {
    const secondProjectBm: Bookmark = { id: 'b4', label: 'Cabin', kind: 'project', projectId: 'p1', color: '#3b82f6' };
    const dispatch = vi.fn();
    render(
      <MemoryRouter>
        <WorkspaceContext.Provider
          value={{ document: doc([projectBm, secondProjectBm]), dispatch } as unknown as UseWorkspace}
        >
          <SidebarBookmarkMenu />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );
    // Ends are disabled within the list.
    expect(screen.getByRole('button', { name: 'Move Vacation up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Cabin down' })).toBeDisabled();
    // Moving Cabin up swaps the two slots.
    fireEvent.click(screen.getByRole('button', { name: 'Move Cabin up' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'reorderBookmarks', order: ['b4', 'b1'] });
  });

  it('the pencil opens a rename dialog — prefilled, empty-guarded, dispatching renameBookmark (#732)', () => {
    const dispatch = vi.fn();
    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ document: doc([projectBm]), dispatch } as unknown as UseWorkspace}>
          <SidebarBookmarkMenu />
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

  it('Cmd/Ctrl+Enter commits the rename dialog like Save (#746)', () => {
    const dispatch = vi.fn();
    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ document: doc([projectBm]), dispatch } as unknown as UseWorkspace}>
          <SidebarBookmarkMenu />
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

  it('a row browse "…" opens the picker already at that project — Open navigates (#595)', () => {
    renderMenu([projectBm]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Browse from Vacation' }));
    // The Finder-style picker in open mode, pre-navigated: the bookmark is already the selection,
    // so Open is immediately available and confirms to it.
    expect(screen.getByText('Open project')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1');
  });
});
