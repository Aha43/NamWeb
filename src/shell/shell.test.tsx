import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { CaptureProvider } from '@/capture/CaptureProvider';
import { ActionEditorProvider } from '@/features/actions/ActionEditorProvider';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { AppRoutes } from '@/routes/AppRoutes';

function setViewport(isDesktop: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: isDesktop,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

afterEach(() => {
  setViewport(false);
  localStorage.clear();
});

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

function workspace(): UseWorkspace {
  const document: WorkspaceDocument = {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox',
    projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: {
      root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
      inbox: node('inbox'), projects: node('projects'), actions: node('actions'),
    },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
  return {
    document, loading: false, error: null, noRemote: false, creating: false,
    createWorkspace: vi.fn(), notice: null,
    clearNotice: vi.fn(), retry: vi.fn(), dispatch: vi.fn(),
  };
}

function renderShell(isDesktop: boolean) {
  setViewport(isDesktop);
  render(
    <ThemeProvider>
      <WorkspaceContext.Provider value={workspace()}>
        <MemoryRouter initialEntries={['/inbox']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CaptureProvider>
            <ActionEditorProvider>
              <AppRoutes />
            </ActionEditorProvider>
          </CaptureProvider>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </ThemeProvider>,
  );
}

describe('adaptive shell', () => {
  it('phone: capture + execution forward, sidebar absent', () => {
    renderShell(false);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sidebar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Capture' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Focus' })).toBeInTheDocument();
  });

  it('phone: secondary surfaces (Backlog) live behind the More sheet', () => {
    renderShell(false);
    // Backlog is not a primary bottom-bar item.
    expect(screen.queryByRole('link', { name: 'Backlog' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const more = screen.getByRole('navigation', { name: 'More' });
    expect(within(more).getByRole('link', { name: 'Backlog' })).toBeInTheDocument();
  });

  it('desktop: grouped sidebar with Capture + Focus promoted to buttons, no bottom bar', () => {
    renderShell(true);
    const sidebar = screen.getByRole('navigation', { name: 'Sidebar' });
    expect(within(sidebar).getByRole('link', { name: 'Backlog' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Inbox' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    // The two "do" actions are foregrounded above the grouped list; Focus is no longer a list item.
    expect(screen.getByRole('button', { name: 'Capture' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Focus' })).toHaveAttribute('href', '/focus');
    expect(within(sidebar).queryByRole('link', { name: 'Focus' })).not.toBeInTheDocument();
    // Section headings group the list.
    expect(within(sidebar).getByText('Lenses')).toBeInTheDocument();
    expect(within(sidebar).getByText('Organize')).toBeInTheDocument();
  });

  it('desktop: top toolbar carries search, theme toggle and the account menu (not the sidebar)', () => {
    renderShell(true);
    expect(screen.getByRole('searchbox', { name: 'Search workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    // Sign out now lives inside the account menu (top-right user icon).
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    // Search + Tags moved out of the sidebar nav (still in SURFACES for phone's More sheet).
    const sidebar = screen.getByRole('navigation', { name: 'Sidebar' });
    expect(within(sidebar).queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole('link', { name: 'Tags' })).not.toBeInTheDocument();
    // Tags is reachable from the toolbar instead.
    expect(screen.getByRole('link', { name: 'Tags' })).toHaveAttribute('href', '/tags');
  });

  it('desktop: a draggable divider separates the view list from the workspace', () => {
    renderShell(true);
    const divider = screen.getByRole('separator', { name: 'Resize sidebar' });
    expect(divider).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('desktop: collapsing hides the view list, leaving an expand button', () => {
    renderShell(true);
    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.queryByRole('navigation', { name: 'Sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('separator', { name: 'Resize sidebar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument();
  });
});
