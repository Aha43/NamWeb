import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { ActionEditorContext } from './action-editor-context';
import { ResourcesEditor } from './ResourcesEditor';
import { makeActionLink } from '@/domain/actionLinks';

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
    p1: node('p1', { title: 'Home', project: true, childIds: ['a1'] }),
    a1: node('a1', { title: 'Fix door', status: 'NEXT' }),
  },
  registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
};

function renderWithProviders(resources = [makeActionLink('a1')], onChange = vi.fn(), openEditor = vi.fn()) {
  render(
    <WorkspaceContext.Provider value={{ document: doc, dispatch: vi.fn() } as unknown as UseWorkspace}>
      <ActionEditorContext.Provider value={{ openEditor }}>
        <ResourcesEditor resources={resources} onChange={onChange} linkExcludeId="self" />
      </ActionEditorContext.Provider>
    </WorkspaceContext.Provider>,
  );
  return { onChange, openEditor };
}

describe('ResourcesEditor action links (#658)', () => {
  it('renders a link as the live breadcrumb path; clicking opens the target editor', () => {
    const { openEditor } = renderWithProviders();
    const link = screen.getByRole('button', { name: 'Open linked action Fix door' });
    expect(link).toHaveTextContent('Home › Fix door');
    fireEvent.click(link);
    expect(openEditor).toHaveBeenCalledWith('a1');
  });

  it('a gone target renders as gone, and stays removable', () => {
    const { onChange } = renderWithProviders([makeActionLink('vanished')]);
    expect(screen.getByText('Linked action no longer exists')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remove resource/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('Link action… opens the browser and picking appends the link resource', () => {
    const { onChange } = renderWithProviders([]);
    fireEvent.click(screen.getByRole('button', { name: 'Link action…' }));
    // Drill into Home and pick its action.
    fireEvent.click(screen.getByRole('button', { name: /Home/ }));
    fireEvent.click(screen.getByRole('button', { name: /Fix door/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Link$/ }));
    expect(onChange).toHaveBeenCalledWith([makeActionLink('a1')]);
  });

  it('the "…" re-pick replaces the link in place', () => {
    const other = node('a2', { title: 'Paint wall', status: 'NEXT' });
    doc.nodes['a2'] = other;
    doc.nodes['p1'].childIds.push('a2');
    const first = makeActionLink('a1');
    const { onChange } = renderWithProviders([first]);
    fireEvent.click(screen.getByRole('button', { name: 'Change link' }));
    fireEvent.click(screen.getByRole('button', { name: /Home/ }));
    fireEvent.click(screen.getByRole('button', { name: /Paint wall/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Link$/ }));
    expect(onChange).toHaveBeenCalledWith([makeActionLink('a2')]);
    delete doc.nodes['a2'];
    doc.nodes['p1'].childIds.pop();
  });

  it('renders a raw URI row without a workspace provider (presentational hosts)', () => {
    render(<ResourcesEditor resources={[makeActionLink('a1')]} onChange={vi.fn()} />);
    expect(screen.getByText('nam://action/a1')).toBeInTheDocument();
  });
});
