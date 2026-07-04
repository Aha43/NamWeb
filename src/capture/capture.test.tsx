import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import { SettingsContext, useSettings } from '@/components/settings/settings-context';
import { applyIntent, type Intent } from '@/domain/mutations';
import { WithAuthUser } from '@/test/authUser';
import { AppRoutes } from '@/routes/AppRoutes';
import { ActionEditorProvider } from '@/features/actions/ActionEditorProvider';
import { CaptureProvider } from './CaptureProvider';
import { CaptureSheet } from './CaptureSheet';

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
    clearNotice: vi.fn(), retry: vi.fn(), retrySync: vi.fn(), dispatch: vi.fn(),
  };
}

describe('CaptureSheet', () => {
  it('dispatches addInboxItem with the trimmed title and clears', () => {
    const ws = workspace();
    render(
      <ThemeProvider>
        <WorkspaceContext.Provider value={ws}>
          <CaptureSheet open onOpenChange={() => {}} />
        </WorkspaceContext.Provider>
      </ThemeProvider>,
    );
    const input = screen.getByLabelText('Capture to inbox');
    fireEvent.change(input, { target: { value: '  Buy milk  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(ws.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'addInboxItem', title: 'Buy milk' }),
    );
    expect(input).toHaveValue('');
  });

  it('renders as a centered modal on desktop and still captures', () => {
    // Force desktop width so CaptureSheet takes the Dialog branch.
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    try {
      const ws = workspace();
      render(
        <ThemeProvider>
          <WorkspaceContext.Provider value={ws}>
            <CaptureSheet open onOpenChange={() => {}} />
          </WorkspaceContext.Provider>
        </ThemeProvider>,
      );
      const dialog = screen.getByRole('dialog');
      const input = within(dialog).getByLabelText('Capture to inbox');
      fireEvent.change(input, { target: { value: 'Desk note' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      expect(ws.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'addInboxItem', title: 'Desk note' }),
      );
    } finally {
      window.matchMedia = original;
    }
  });
});

/** A live workspace: dispatch applies the real reducer, so the "Just added" list renders. */
function LiveHarness({ recentLimit }: { recentLimit?: number }) {
  const [document, setDocument] = useState<WorkspaceDocument>(() => workspace().document as WorkspaceDocument);
  const value = {
    document,
    dispatch: (intent: Intent) => setDocument((doc) => applyIntent(doc, intent)),
  } as unknown as UseWorkspace;
  const settings = useSettings(); // provider-less defaults
  const body = (
    <WorkspaceContext.Provider value={value}>
      <ToastProvider>
        <CaptureSheet open onOpenChange={() => {}} />
      </ToastProvider>
    </WorkspaceContext.Provider>
  );
  if (recentLimit === undefined) return <ThemeProvider>{body}</ThemeProvider>;
  return (
    <ThemeProvider>
      <SettingsContext.Provider value={{ ...settings, captureRecentLimit: recentLimit }}>
        {body}
      </SettingsContext.Provider>
    </ThemeProvider>
  );
}

function capture(title: string) {
  fireEvent.change(screen.getByLabelText('Capture to inbox'), { target: { value: title } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

describe('CaptureSheet — the "Just added" list (#617)', () => {
  it('deletes a row with the Undo toast, and Undo brings it back', () => {
    render(<LiveHarness />);
    capture('Buy milk');
    expect(screen.getByText('Buy milk')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Buy milk' }));
    // The row drops off (live lookup) and the Undo toast appears.
    expect(screen.queryByText('Buy milk')).not.toBeInTheDocument();
    expect(screen.getByText('Deleted "Buy milk"')).toBeInTheDocument();

    // hidden: the toast sits outside the modal dialog, which aria-hides the rest of the page;
    // it stays visible and clickable (z-60, pointer-events re-enabled).
    fireEvent.click(screen.getByRole('button', { name: 'Undo', hidden: true }));
    expect(screen.getByText('Buy milk')).toBeInTheDocument(); // restored — id was still in recentIds
  });

  it('honors the captureRecentLimit preference', () => {
    render(<LiveHarness recentLimit={2} />);
    capture('one');
    capture('two');
    capture('three');
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    // Newest first: "three" and "two" stay, "one" dropped off.
    expect(within(list).getByText('three')).toBeInTheDocument();
    expect(within(list).getByText('two')).toBeInTheDocument();
    expect(within(list).queryByText('one')).not.toBeInTheDocument();
  });

  it('keeps the default limit of four', () => {
    render(<LiveHarness />);
    ['a', 'b', 'c', 'd', 'e'].forEach(capture);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
  });
});

describe('capture from the shell', () => {
  it('opens the capture sheet from the phone Capture button', () => {
    render(
      <WithAuthUser>
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
        </ThemeProvider>
      </WithAuthUser>,
    );
    expect(screen.queryByLabelText('Capture to inbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Capture' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Capture to inbox')).toBeInTheDocument();
  });
});
