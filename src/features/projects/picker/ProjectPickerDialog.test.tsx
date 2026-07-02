import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace } from '@/store/useWorkspace';
import { ProjectPickerDialog } from './ProjectPickerDialog';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

const doc: WorkspaceDocument = {
  formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
  nodes: {
    root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    inbox: node('inbox'),
    projects: node('projects', { childIds: ['p1'] }),
    actions: node('actions'),
    p1: node('p1', { title: 'Home', project: true }),
  },
  registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
};

function renderPicker(over: Partial<React.ComponentProps<typeof ProjectPickerDialog>> = {}) {
  const onConfirm = vi.fn();
  render(
    <WorkspaceContext.Provider value={{ document: doc, dispatch: vi.fn() } as unknown as UseWorkspace}>
      <ProjectPickerDialog
        open
        onOpenChange={vi.fn()}
        title="Move"
        targets={[{ id: 'p1', label: 'Home' }]}
        onConfirm={onConfirm}
        {...over}
      />
    </WorkspaceContext.Provider>,
  );
  return { onConfirm };
}

describe('ProjectPickerDialog — ⌘/Ctrl+Enter', () => {
  it('confirms the selection from anywhere in the dialog (#544)', () => {
    const { onConfirm } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    expect(onConfirm).toHaveBeenCalledWith('p1');
  });

  it('does not hijack the "New project…" prompt — the typed name survives (#574)', () => {
    const { onConfirm } = renderPicker({ onCreateProject: vi.fn(() => 'new-id') });
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    fireEvent.click(screen.getByRole('button', { name: /New project in/ }));
    const input = screen.getByLabelText('New project name');
    fireEvent.change(input, { target: { value: 'Groceries' } });
    // ⌘Enter while typing must not confirm-and-close the picker over the prompt.
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New project name')).toHaveValue('Groceries');
  });
});
