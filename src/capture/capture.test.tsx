import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
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
    // Enter's implicit form submission still works…
    fireEvent.submit(input);
    expect(ws.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'addInboxItem', title: 'Buy milk' }),
    );
    expect(input).toHaveValue('');
    // …and the PHONE has a visible submit again (#784: some keyboards never fire Enter —
    // the ✓ key just blurs, making buttonless a dead end). enterkeyhint asks for a Go key.
    expect(input).toHaveAttribute('enterkeyhint', 'go');
    const add = screen.getByRole('button', { name: 'Add to inbox' });
    fireEvent.change(input, { target: { value: 'Buy oat milk' } });
    fireEvent.click(add);
    expect(ws.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'addInboxItem', title: 'Buy oat milk' }),
    );
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
      fireEvent.submit(input);
      expect(ws.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'addInboxItem', title: 'Desk note' }),
      );
    } finally {
      window.matchMedia = original;
    }
  });

  it('resizes via the corner handle (keyboard) and remembers the size (#626)', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    try {
      localStorage.removeItem('namweb.capture.size');
      const ws = workspace();
      const { unmount } = render(
        <ThemeProvider>
          <WorkspaceContext.Provider value={ws}>
            <CaptureSheet open onOpenChange={() => {}} />
          </WorkspaceContext.Provider>
        </ThemeProvider>,
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveStyle({ height: '400px' }); // default size until resized
      const handle = within(dialog).getByRole('separator', { name: 'Resize capture dialog' });
      fireEvent.keyDown(handle, { key: 'ArrowDown' }); // 400 (baseline) + 16
      fireEvent.keyDown(handle, { key: 'ArrowRight' }); // 512 (baseline) + 16
      expect(dialog).toHaveStyle({ width: '528px', height: '416px' });
      expect(JSON.parse(localStorage.getItem('namweb.capture.size')!)).toEqual({ width: 528, height: 416 });

      // Remembered: a fresh mount opens at the dragged size.
      unmount();
      render(
        <ThemeProvider>
          <WorkspaceContext.Provider value={workspace()}>
            <CaptureSheet open onOpenChange={() => {}} />
          </WorkspaceContext.Provider>
        </ThemeProvider>,
      );
      const dialog2 = screen.getByRole('dialog');
      expect(dialog2).toHaveStyle({ width: '528px', height: '416px' });

      // The remembered size re-clamps when the viewport narrows while mounted (#628).
      const { innerWidth, innerHeight } = window;
      try {
        Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true });
        fireEvent(window, new Event('resize'));
        expect(dialog2).toHaveStyle({ width: '368px', height: '268px' }); // viewport − 32 (fits-on-screen beats MIN)
      } finally {
        Object.defineProperty(window, 'innerWidth', { value: innerWidth, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true });
      }
    } finally {
      window.matchMedia = original;
      localStorage.removeItem('namweb.capture.size');
    }
  });
});

/** A live workspace: dispatch applies the real reducer, so the "Just added" list renders. */
function LiveHarness() {
  const [document, setDocument] = useState<WorkspaceDocument>(() => workspace().document as WorkspaceDocument);
  const value = {
    document,
    dispatch: (intent: Intent) => setDocument((doc) => applyIntent(doc, intent)),
  } as unknown as UseWorkspace;
  return (
    <ThemeProvider>
      <WorkspaceContext.Provider value={value}>
        <ToastProvider>
          <CaptureSheet open onOpenChange={() => {}} />
        </ToastProvider>
      </WorkspaceContext.Provider>
    </ThemeProvider>
  );
}

function capture(title: string) {
  const input = screen.getByLabelText('Capture to inbox');
  fireEvent.change(input, { target: { value: title } });
  fireEvent.submit(input); // Enter's implicit submission — there is no Add button (#626)
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

  it('keeps every capture of the session listed, newest first (#622 — no size cap)', () => {
    render(<LiveHarness />);
    const titles = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    titles.forEach(capture);
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows).toHaveLength(titles.length);
    expect(rows[0]).toHaveTextContent('g'); // newest first
    expect(rows[rows.length - 1]).toHaveTextContent('a');
  });
});

describe('CaptureSheet — processing station (#623)', () => {
  let lastDoc: WorkspaceDocument | null = null;
  function LiveHarnessWithSpy({ onDoc }: { onDoc: (d: WorkspaceDocument) => void }) {
    const [document, setDocument] = useState<WorkspaceDocument>(() => workspace().document as WorkspaceDocument);
    onDoc(document);
    const value = {
      document,
      dispatch: (intent: Intent) => setDocument((doc) => applyIntent(doc, intent)),
    } as unknown as UseWorkspace;
    return (
      <ThemeProvider>
        <WorkspaceContext.Provider value={value}>
          <ToastProvider>
            <CaptureSheet open onOpenChange={() => {}} />
          </ToastProvider>
        </WorkspaceContext.Provider>
      </ThemeProvider>
    );
  }
  const renderSpied = () => render(<LiveHarnessWithSpy onDoc={(d) => (lastDoc = d)} />);
  const nodeByTitle = (title: string) => Object.values(lastDoc!.nodes).find((n) => n.title === title)!;

  function enterSelect() {
    fireEvent.click(screen.getByRole('button', { name: 'Select items' }));
  }
  const check = (title: string) => fireEvent.click(screen.getByRole('checkbox', { name: `Select ${title}` }));
  // Drive the wizard (#635). The harness renders the phone branch (no matchMedia), so the
  // destination step is the native select; '' (default location) is preselected.
  function processVia(statusOption: 'Next' | 'Backlog' | 'Make projects') {
    fireEvent.click(screen.getByRole('button', { name: 'Process…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); // destination step → status step
    fireEvent.click(screen.getByRole('button', { name: statusOption }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  }

  it('wizard: selected captures become Next at the default location, marked with ✓', () => {
    renderSpied();
    ['idea one', 'idea two', 'idea three'].forEach(capture);
    enterSelect();
    check('idea one');
    check('idea two');
    processVia('Next');

    // The intents moved them out of the inbox with the status set.
    expect(nodeByTitle('idea one').status).toBe('NEXT');
    expect(nodeByTitle('idea two').status).toBe('NEXT');
    expect(lastDoc!.nodes['actions'].childIds).toContain(nodeByTitle('idea one').id);
    expect(lastDoc!.nodes['inbox'].childIds).toContain(nodeByTitle('idea three').id); // untouched

    // The wizard folded away; processed rows stay, marked; the third is still selectable.
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getAllByText('Next')).toHaveLength(2);
    expect(screen.queryByRole('checkbox', { name: 'Select idea one' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select idea three' })).toBeInTheDocument();
  });

  it('wizard: Done is disabled until a status is chosen; Back returns to the destination step', () => {
    renderSpied();
    capture('undecided');
    enterSelect();
    check('undecided');
    fireEvent.click(screen.getByRole('button', { name: 'Process…' }));
    expect(screen.getByLabelText('File under')).toBeInTheDocument(); // destination step (phone select)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('File under')).toBeInTheDocument();
    // Cancel exits the wizard without committing; the selection is intact.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(nodeByTitle('undecided').status).toBe('BACKLOG'); // still a raw inbox item
    expect(lastDoc!.nodes['inbox'].childIds).toContain(nodeByTitle('undecided').id);
  });

  it('wizard: Make projects converts the selection and marks the rows', () => {
    renderSpied();
    capture('new epic');
    enterSelect();
    check('new epic');
    processVia('Make projects');
    expect(nodeByTitle('new epic').project).toBe(true);
    expect(lastDoc!.nodes['projects'].childIds).toContain(nodeByTitle('new epic').id);
    expect(within(screen.getByRole('list')).getByText('Project')).toBeInTheDocument();
  });

  it('Select all selects only unprocessed rows', () => {
    renderSpied();
    ['p1', 'p2', 'p3'].forEach(capture);
    enterSelect();
    check('p1');
    processVia('Backlog');
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('wizard (desktop): the embedded columns pick a real project destination', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    try {
      renderSpied();
      // First pass: turn one capture into a project so the columns have a destination.
      capture('Home');
      enterSelect();
      check('Home');
      fireEvent.click(screen.getByRole('button', { name: 'Process…' }));
      // Desktop: the Miller columns are embedded; the default location is preselected → Next works.
      expect(screen.getByRole('button', { name: 'Default (Top level / Free actions)' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Make projects' }));
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(nodeByTitle('Home').project).toBe(true);

      // Second pass: file a new capture under it via the columns (mounted fresh per wizard entry).
      capture('garage door');
      check('garage door');
      fireEvent.click(screen.getByRole('button', { name: 'Process…' }));
      fireEvent.click(screen.getByRole('button', { name: 'Home' })); // select the project column item
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next', pressed: false })); // the status option
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      const filed = nodeByTitle('garage door');
      expect(filed.status).toBe('NEXT');
      expect(nodeByTitle('Home').childIds).toContain(filed.id);
      expect(screen.getByText('Next · Home')).toBeInTheDocument(); // the ✓ marker names the project
    } finally {
      window.matchMedia = original;
    }
  });

  it('bulk delete confirms, removes the rows, and one grouped Undo restores them', () => {
    renderSpied();
    ['d1', 'd2'].forEach(capture);
    enterSelect();
    check('d1');
    check('d2');
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected items' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' })); // the confirm (exact name)
    expect(within(screen.queryByRole('list') ?? window.document.body).queryByText('d1')).not.toBeInTheDocument();
    expect(screen.getByText('Deleted 2 items')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo', hidden: true }));
    const list = screen.getByRole('list');
    expect(within(list).getByText('d1')).toBeInTheDocument();
    expect(within(list).getByText('d2')).toBeInTheDocument();
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
