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

  it('picking an already-linked target again is a no-op (#663)', () => {
    const { onChange } = renderWithProviders([makeActionLink('a1')]);
    fireEvent.click(screen.getByRole('button', { name: 'Link action…' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Home/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Fix door/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Link$/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('re-picking an existing target via "…" collapses to one row (#663)', () => {
    const other = node('a2', { title: 'Paint wall', status: 'NEXT' });
    doc.nodes['a2'] = other;
    doc.nodes['p1'].childIds.push('a2');
    // Row 0 links a2, row 1 links a1; re-pick row 1's target to a2 → row 1 dropped.
    const { onChange } = renderWithProviders([makeActionLink('a2'), makeActionLink('a1')]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Change link' })[1]);
    fireEvent.click(screen.getAllByRole('button', { name: /Home/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Paint wall/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Link$/ }));
    expect(onChange).toHaveBeenCalledWith([makeActionLink('a2')]);
    delete doc.nodes['a2'];
    doc.nodes['p1'].childIds.pop();
  });

  it('onFollowLink overrides the link-row click (#663)', () => {
    const onFollowLink = vi.fn();
    render(
      <WorkspaceContext.Provider value={{ document: doc, dispatch: vi.fn() } as unknown as UseWorkspace}>
        <ResourcesEditor resources={[makeActionLink('a1')]} onChange={vi.fn()} onFollowLink={onFollowLink} />
      </WorkspaceContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open linked action Fix door' }));
    expect(onFollowLink).toHaveBeenCalledWith('a1');
  });

  it('renders a raw URI row without a workspace provider (presentational hosts)', () => {
    render(<ResourcesEditor resources={[makeActionLink('a1')]} onChange={vi.fn()} />);
    expect(screen.getByText('nam://action/a1')).toBeInTheDocument();
  });
});

describe('ResourcesEditor http links (#715)', () => {
  it('adds a URI with an optional display name stored in description — via the dialog (#720)', () => {
    const onChange = vi.fn();
    render(<ResourcesEditor resources={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add resource…' }));
    fireEvent.change(screen.getByLabelText('Resource value'), { target: { value: 'https://example.com/docs' } });
    fireEvent.change(screen.getByLabelText('Link name (optional)'), { target: { value: 'The docs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenCalledWith([
      { type: 'URI', value: 'https://example.com/docs', description: 'The docs' },
    ]);
    // The dialog closed after the commit.
    expect(screen.queryByLabelText('Resource value')).not.toBeInTheDocument();
  });

  it('an http resource renders as a real link — named when a name is set, opening a new tab', () => {
    render(
      <ResourcesEditor
        resources={[{ type: 'URI', value: 'https://example.com/docs', description: 'The docs' }]}
        onChange={vi.fn()}
      />,
    );
    const link = screen.getByRole('link', { name: 'The docs' });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('an unnamed http resource shows (and links) the URL itself', () => {
    render(
      <ResourcesEditor
        resources={[{ type: 'URI', value: 'https://example.com', description: null }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('link', { name: 'https://example.com' })).toHaveAttribute('href', 'https://example.com');
  });

  it('non-http values stay plain text; the name field only appears for URI', () => {
    render(
      <ResourcesEditor resources={[{ type: 'TEXT', value: 'just a note', description: null }]} onChange={vi.fn()} />,
    );
    expect(screen.getByText('just a note')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add resource…' }));
    fireEvent.change(screen.getByLabelText('Resource type'), { target: { value: 'TEXT' } });
    expect(screen.queryByLabelText('Link name (optional)')).not.toBeInTheDocument();
  });
});

describe('ResourcesEditor dialogs (#720)', () => {
  it('edits a resource in place via the row\'s "…" — prefilled, mapped back to its index', () => {
    const onChange = vi.fn();
    render(
      <ResourcesEditor
        resources={[
          { type: 'TEXT', value: 'keep me', description: null },
          { type: 'URI', value: 'https://example.com/docs', description: 'The docs' },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit resource The docs' }));
    const value = screen.getByLabelText('Resource value');
    expect(value).toHaveValue('https://example.com/docs');
    expect(screen.getByLabelText('Link name (optional)')).toHaveValue('The docs');
    fireEvent.change(screen.getByLabelText('Link name (optional)'), { target: { value: 'The real docs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChange).toHaveBeenCalledWith([
      { type: 'TEXT', value: 'keep me', description: null },
      { type: 'URI', value: 'https://example.com/docs', description: 'The real docs' },
    ]);
  });

  it('editing a non-URI resource preserves its (possibly desktop-written) description (#724)', () => {
    const onChange = vi.fn();
    render(
      <ResourcesEditor
        resources={[{ type: 'FILE', value: '/old/path.pdf', description: 'Q3 report scan' }]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit resource Q3 report scan' }));
    fireEvent.change(screen.getByLabelText('Resource value'), { target: { value: '/new/path.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChange).toHaveBeenCalledWith([
      { type: 'FILE', value: '/new/path.pdf', description: 'Q3 report scan' },
    ]);
  });

  it('⌘/Ctrl+Enter commits the resource dialog like Save — empty still refuses (#746)', () => {
    const onChange = vi.fn();
    render(<ResourcesEditor resources={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add resource…' }));
    const value = screen.getByLabelText('Resource value');

    // Empty: the gesture refuses, dialog stays.
    fireEvent.keyDown(value, { key: 'Enter', ctrlKey: true });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(value, { target: { value: 'https://example.com' } });
    fireEvent.keyDown(value, { key: 'Enter', ctrlKey: true });
    expect(onChange).toHaveBeenCalledWith([{ type: 'URI', value: 'https://example.com', description: null }]);
    expect(screen.queryByLabelText('Resource value')).not.toBeInTheDocument(); // closed
  });

  it('creates a counter via the dialog — target in, packed 0/N out (#798)', () => {
    const onChange = vi.fn();
    render(<ResourcesEditor resources={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add resource…' }));
    fireEvent.change(screen.getByLabelText('Resource type'), { target: { value: 'COUNT' } });
    fireEvent.change(screen.getByLabelText('Count to'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Counter name (optional)'), { target: { value: 'boxes to the attic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenCalledWith([
      { type: 'COUNT', value: '0/12', description: 'boxes to the attic' },
    ]);
  });

  it('the guest-delegation checkbox writes guestEditable — only when ticked, never false (#809)', () => {
    const onChange = vi.fn();
    render(<ResourcesEditor resources={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add resource…' }));
    fireEvent.change(screen.getByLabelText('Resource type'), { target: { value: 'COUNT' } });
    fireEvent.change(screen.getByLabelText('Count to'), { target: { value: '5' } });
    fireEvent.click(screen.getByLabelText('Guests can update this on shared pages'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenCalledWith([{ type: 'COUNT', value: '0/5', description: null, guestEditable: true }]);
    // Unticked: the key is ABSENT (additive, absent-means-off), not false.
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Add resource…' }));
    fireEvent.change(screen.getByLabelText('Resource type'), { target: { value: 'COUNT' } });
    fireEvent.change(screen.getByLabelText('Count to'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    // (The editor is controlled — the un-rerendered second Add still emits a one-element array.)
    expect(onChange.mock.calls[0][0][0]).toEqual({ type: 'COUNT', value: '0/5', description: null });
  });

  it('the goal-not-a-cap checkbox packs the "+" marker; editing keeps overshoot (#800)', () => {
    const onChange = vi.fn();
    render(<ResourcesEditor resources={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add resource…' }));
    fireEvent.change(screen.getByLabelText('Resource type'), { target: { value: 'COUNT' } });
    fireEvent.change(screen.getByLabelText('Count to'), { target: { value: '12' } });
    fireEvent.click(screen.getByLabelText('Goal, not a cap — keep counting past it'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenCalledWith([{ type: 'COUNT', value: '0/12+', description: null }]);
  });

  it('un-ticking "goal, not a cap" on an overshot counter warns before clamping (#802/F2)', () => {
    render(
      <ResourcesEditor
        resources={[{ type: 'COUNT', value: '14/12+', description: 'jars' }]}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit resource jars' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Goal, not a cap — keep counting past it'));
    expect(screen.getByRole('alert')).toHaveTextContent('Saving will clamp the count from 14 to 12');
    // Raising the target past the overshoot dissolves the warning.
    fireEvent.change(screen.getByLabelText('Count to'), { target: { value: '14' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('an unlimited editor row keeps its +1 past the goal and shows the bare count (#800)', () => {
    const onChange = vi.fn();
    render(
      <ResourcesEditor
        resources={[{ type: 'COUNT', value: '12/12+', description: 'jars' }]}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('12/12')).toBeInTheDocument(); // marker stays off the page
    fireEvent.click(screen.getByRole('button', { name: 'Count one on jars' }));
    expect(onChange).toHaveBeenCalledWith([{ type: 'COUNT', value: '13/12+', description: 'jars' }]);
  });

  it('the editor row +1 is buffered — onChange carries the bumped value (#798)', () => {
    const onChange = vi.fn();
    render(
      <ResourcesEditor
        resources={[{ type: 'COUNT', value: '2/3', description: 'boxes' }]}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('2/3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Count one on boxes' }));
    expect(onChange).toHaveBeenCalledWith([{ type: 'COUNT', value: '3/3', description: 'boxes' }]);
  });

  it('the commit button disables on an empty value; cancel discards', () => {
    const onChange = vi.fn();
    render(<ResourcesEditor resources={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add resource…' }));
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Resource value'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports nested-dialog state so a hosting editor can suspend ⌘Enter (#574/#720)', () => {
    const onNestedOpenChange = vi.fn();
    render(<ResourcesEditor resources={[]} onChange={vi.fn()} onNestedOpenChange={onNestedOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add resource…' }));
    expect(onNestedOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onNestedOpenChange).toHaveBeenLastCalledWith(false);
  });
});
