import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { CaptureProvider } from '@/capture/CaptureProvider';
import { ActionEditorProvider } from '@/features/actions/ActionEditorProvider';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { WithAuthUser } from '@/test/authUser';
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

function workspace(inboxChildren: string[] = []): UseWorkspace {
  const document: WorkspaceDocument = {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox',
    projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: {
      root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
      inbox: node('inbox', { childIds: inboxChildren }),
      projects: node('projects'), actions: node('actions'),
      ...Object.fromEntries(inboxChildren.map((id) => [id, node(id)])),
    },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
  return {
    document, loading: false, error: null, noRemote: false, creating: false,
    createWorkspace: vi.fn(), notice: null,
    clearNotice: vi.fn(), retry: vi.fn(), retrySync: vi.fn(), dispatch: vi.fn(),
  };
}

function renderShell(isDesktop: boolean, inboxChildren: string[] = []) {
  setViewport(isDesktop);
  render(
    <WithAuthUser>
      <ThemeProvider>
        <WorkspaceContext.Provider value={workspace(inboxChildren)}>
          <MemoryRouter initialEntries={['/inbox']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <CaptureProvider>
              <ActionEditorProvider>
                <AppRoutes />
              </ActionEditorProvider>
            </CaptureProvider>
          </MemoryRouter>
        </WorkspaceContext.Provider>
      </ThemeProvider>
    </WithAuthUser>,
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
    // The slimmed list dropped its section headings (#590) — spacing alone groups it.
    expect(within(sidebar).queryByText('Views')).not.toBeInTheDocument();
    expect(within(sidebar).queryByText('Organize')).not.toBeInTheDocument();
  });

  it('desktop: top toolbar carries search, theme toggle and the account menu (not the sidebar)', () => {
    renderShell(true);
    expect(screen.getByRole('searchbox', { name: 'Search workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    // Sign out now lives inside the account menu (top-right user icon).
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    // Search stays in the toolbar (not the sidebar). Contexts (formerly Tags) is promoted to a button
    // above the list (#557), so it's no longer inside the Sidebar nav — but still links to /tags.
    const sidebar = screen.getByRole('navigation', { name: 'Sidebar' });
    expect(within(sidebar).queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole('link', { name: 'Contexts' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contexts' })).toHaveAttribute('href', '/tags');
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

  it('phone: the bottom-bar inbox cue — badge + red glow when unprocessed, green when clear (#778)', () => {
    renderShell(false, ['c1', 'c2', 'c3']);
    const link = screen.getByRole('link', { name: 'Inbox' });
    expect(link).toHaveTextContent('3'); // the badge
    expect(link.querySelector('.inbox-glow-attention')).not.toBeNull();

    cleanup();
    renderShell(false, []);
    const clear = screen.getByRole('link', { name: 'Inbox' });
    expect(clear).not.toHaveTextContent('0'); // no zero badge
    expect(clear.querySelector('.inbox-glow-clear')).not.toBeNull();
  });

  it('desktop: the inbox cue — red glow + badge when unprocessed, green glow when clear (#764)', () => {
    renderShell(true, ['c1', 'c2']);
    expect(screen.getByLabelText('2 unprocessed')).toBeInTheDocument(); // the badge
    const link = screen.getByRole('link', { name: 'Inbox' });
    expect(link.querySelector('.inbox-glow-attention')).not.toBeNull();

    cleanup();
    renderShell(true, []);
    expect(screen.queryByLabelText(/unprocessed/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inbox' }).querySelector('.inbox-glow-clear')).not.toBeNull();
  });
});
