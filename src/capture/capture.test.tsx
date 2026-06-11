import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
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
    document, loading: false, error: null, noRemote: false, notice: null,
    clearNotice: vi.fn(), retry: vi.fn(), dispatch: vi.fn(),
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
});

describe('capture from the shell', () => {
  it('opens the capture sheet from the phone Capture button', () => {
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
    expect(screen.queryByLabelText('Capture to inbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Capture' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Capture to inbox')).toBeInTheDocument();
  });
});
