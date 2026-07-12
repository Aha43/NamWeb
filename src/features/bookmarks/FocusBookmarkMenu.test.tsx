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
}));

import { FocusBookmarkMenu } from './FocusBookmarkMenu';

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
const contextBm: Bookmark = { id: 'b3', label: 'After work', kind: 'tagFilter', tags: ['daily'], nextOnly: true, color: '#10b981' };

function renderMenu(bookmarks: Bookmark[]) {
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={{ document: doc(bookmarks), dispatch: vi.fn() } as unknown as UseWorkspace}>
        <FocusBookmarkMenu />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
}

describe('FocusBookmarkMenu (#738)', () => {
  it('renders nothing when there are no bookmarks at all', () => {
    renderMenu([]);
    expect(screen.queryByRole('button', { name: 'Focus bookmarks' })).not.toBeInTheDocument();
  });

  it('lists both kinds in stored order and deals the deck scoped to the clicked bookmark', () => {
    renderMenu([projectBm, contextBm]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Focus: Vacation' }));
    expect(navigate).toHaveBeenCalledWith('/focus?project=p1');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Focus: After work' }));
    expect(navigate).toHaveBeenCalledWith('/focus?tags=daily&next=1&bm=b3');
  });

  it('a stale project bookmark is greyed and not dealable', () => {
    renderMenu([staleBm]);
    const row = screen.getByRole('menuitem', { name: 'Focus: Old plans' });
    expect(row).toBeDisabled();
    expect(screen.getByText('(no longer exists)')).toBeInTheDocument();
  });
});
