import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace } from '@/store/useWorkspace';
import { ActionDialog } from './ActionDialog';

function node(partial: Partial<NamNode> = {}): NamNode {
  return {
    id: 'a', title: 'Buy milk', description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}


/** The due controls are dense until asked for (#721) — open them like a user would. Idempotent:
 *  a no-op when already expanded (or when the surface renders without the collapse shell). */
function expandDue() {
  const opener = screen.queryByRole('button', { name: /add due date|edit due date/i });
  if (opener) fireEvent.click(opener);
}

describe('ActionDialog', () => {
  it('seeds the fields from the node', () => {
    render(
      <ActionDialog
        node={node({ title: 'Get quotes', description: 'three of them', tags: ['home', 'phone'], dueAt: '2026-07-01' })}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Get quotes');
    expect(screen.getByLabelText('Description')).toHaveValue('three of them');
    expect(screen.getByLabelText('Tags')).toHaveValue('home, phone');
    expandDue();
    expect(screen.getByLabelText('Due')).toHaveValue('2026-07-01');
  });

  it('hides the time/range extras behind a toggle by default (#559)', () => {
    render(<ActionDialog node={node({ dueAt: '2026-08-12' })} open onOpenChange={vi.fn()} onSave={vi.fn()} />);
    expandDue();
    expect(screen.queryByLabelText('Due end (optional)')).toBeNull();
    expect(screen.queryByLabelText('Due time (optional)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add time or a range/ }));
    expect(screen.getByLabelText('Due end (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Due time (optional)')).toBeInTheDocument();
  });

  it('auto-expands the extras when the action already has time/range data (#559)', () => {
    render(
      <ActionDialog
        node={node({ dueAt: '2026-08-12', dueEndAt: '2026-08-16', dueTime: '09:00' })}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    // Shown directly (seeded), with no toggle to reveal them.
    expandDue();
    expect(screen.queryByRole('button', { name: /Add time or a range/ })).toBeNull();
    expect(screen.getByLabelText('Due end (optional)')).toHaveValue('2026-08-16');
    expect(screen.getByLabelText('Due time (optional)')).toHaveValue('09:00');
  });

  it('shows inherited (rub-off) tags read-only, separate from the editable own tags', () => {
    render(
      <ActionDialog
        node={node({ tags: ['home'] })}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        inheritedTags={['office', 'urgent']}
      />,
    );
    // Own tags remain in the editable field; inherited ones appear as read-only chips, not in the input.
    expect(screen.getByLabelText('Tags')).toHaveValue('home');
    expect(screen.getByText('From project:')).toBeInTheDocument();
    expect(screen.getByText('office')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
  });

  it('saves on Ctrl/Cmd+Enter from within the form', () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(<ActionDialog node={node({ title: 'Keep' })} open onOpenChange={onOpenChange} onSave={onSave} />);
    fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Enter', ctrlKey: true });
    expect(onSave).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('saves on Ctrl/Cmd+Enter even when focus is in a portaled control outside the form (#435)', () => {
    // The bug: a form `onKeyDown` misses keydowns from portaled Radix popovers (Tags/Move/date),
    // whose DOM lives outside the form subtree. The document-level listener catches them — modeled
    // here by dispatching the keydown on `document` itself, which a form handler would never see.
    const onSave = vi.fn();
    render(<ActionDialog node={node({ title: 'Keep' })} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('does not save on plain Enter or during IME composition', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node({ title: 'Keep' })} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Enter', metaKey: true, isComposing: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('suspends the save shortcut while the Move-to picker is on top (#574)', () => {
    // Desktop (the picker button variant), and a workspace document for the picker to render.
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })
    ) as unknown as typeof window.matchMedia;
    try {
      const doc: WorkspaceDocument = {
        formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
        nodes: {
          root: node({ id: 'root', childIds: ['p1'] }),
          p1: node({ id: 'p1', title: 'Home', project: true }),
        },
        registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
      };
      const onSave = vi.fn();
      render(
        <WorkspaceContext.Provider value={{ document: doc, dispatch: vi.fn() } as unknown as UseWorkspace}>
          <ActionDialog
            node={node({ title: 'Keep' })}
            open
            onOpenChange={vi.fn()}
            onSave={onSave}
            moveTargets={[{ id: 'p1', label: 'Home' }]}
            onMove={vi.fn()}
          />
        </WorkspaceContext.Provider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Move / make project' }));
      fireEvent.click(screen.getByRole('button', { name: 'Move to…' }));
      // The picker is on top: ⌘Enter must not save/close the editor underneath.
      fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
      expect(onSave).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = original;
    }
  });

  it('stops listening once closed', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <ActionDialog node={node({ title: 'Keep' })} open onOpenChange={vi.fn()} onSave={onSave} />,
    );
    rerender(<ActionDialog node={node({ title: 'Keep' })} open={false} onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reports the edited fields and chosen status on save, parsing a flexible due date', () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={onOpenChange} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Call plumber  ' } });
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'Home,  phone ' } });
    expandDue();
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '26-8-15' } }); // relaxed input
    fireEvent.click(screen.getByText('Next')); // status radio
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      title: 'Call plumber',
      description: null,
      tags: ['Home', 'phone'],
      dueAt: '2026-08-15',
      dueEndAt: null,
      dueTime: null,
      dueEndTime: null,
      status: 'NEXT',
      resources: [],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('saves a time on the range end too (#500)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Window' } });
    expandDue();
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-12' } });
    fireEvent.click(screen.getByRole('button', { name: /Add time or a range/ })); // reveal the collapsed extras (#559)
    fireEvent.change(screen.getByLabelText('Due time (optional)'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Due end (optional)'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Due end time (optional)'), { target: { value: '17:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: '2026-08-12', dueTime: '09:00', dueEndAt: '2026-08-12', dueEndTime: '17:30' }),
    );
  });

  it('rejects a same-day range whose end time is before the start (#508)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Window' } });
    expandDue();
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-12' } });
    fireEvent.click(screen.getByRole('button', { name: /Add time or a range/ })); // reveal the collapsed extras (#559)
    fireEvent.change(screen.getByLabelText('Due time (optional)'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('Due end (optional)'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Due end time (optional)'), { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/end can’t be before the start/);
  });

  it('allows a same-day range with end time after the start (#508)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Window' } });
    expandDue();
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-12' } });
    fireEvent.click(screen.getByRole('button', { name: /Add time or a range/ })); // reveal the collapsed extras (#559)
    fireEvent.change(screen.getByLabelText('Due time (optional)'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText('Due end (optional)'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Due end time (optional)'), { target: { value: '17:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ dueTime: '09:00', dueEndTime: '17:30' }),
    );
  });

  it('drops an end time when there is no end date (#500)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No end' } });
    expandDue();
    fireEvent.click(screen.getByRole('button', { name: /Add time or a range/ })); // reveal collapsed extras (#559)
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Due end time (optional)'), { target: { value: '17:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueEndAt: null, dueEndTime: null }));
  });

  it('saves a time of day on the start, parsed from a bare hour (#493)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Doctor' } });
    expandDue();
    fireEvent.click(screen.getByRole('button', { name: /Add time or a range/ })); // reveal collapsed extras (#559)
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Due time (optional)'), { target: { value: '14:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueAt: '2026-08-12', dueTime: '14:30' }));
  });

  it('drops a time when there is no date (#493)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No date' } });
    expandDue();
    fireEvent.click(screen.getByRole('button', { name: /Add time or a range/ })); // reveal collapsed extras (#559)
    fireEvent.change(screen.getByLabelText('Due time (optional)'), { target: { value: '14:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueAt: null, dueTime: null }));
  });

  it('saves a due date range (start + end) via dueEndAt (#438)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Trip' } });
    expandDue();
    fireEvent.click(screen.getByRole('button', { name: /Add time or a range/ })); // reveal collapsed extras (#559)
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Due end (optional)'), { target: { value: '26-8-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: '2026-08-12', dueEndAt: '2026-08-16' }),
    );
  });

  it('clears the due date (and range) via Clear (#459)', () => {
    const onSave = vi.fn();
    render(
      <ActionDialog
        node={node({ title: 'Trip', dueAt: '2026-08-12', dueEndAt: '2026-08-16' })}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );
    expandDue();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueAt: null, dueEndAt: null }));
  });

  it('rejects an end date before the start (no save) (#438)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Trip' } });
    expandDue();
    fireEvent.click(screen.getByRole('button', { name: /Add time or a range/ })); // reveal collapsed extras (#559)
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-16' } });
    fireEvent.change(screen.getByLabelText('Due end (optional)'), { target: { value: '2026-08-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('echoes a canonical ISO due date on blur, leaving invalid text untouched', () => {
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={vi.fn()} />);
    expandDue();
    const dueField = screen.getByLabelText('Due');

    fireEvent.change(dueField, { target: { value: '26-7-4' } });
    fireEvent.blur(dueField);
    expect(dueField).toHaveValue('2026-07-04');

    fireEvent.change(dueField, { target: { value: 'whenever' } });
    fireEvent.blur(dueField);
    expect(dueField).toHaveValue('whenever');
  });

  it('blocks save and flags an invalid due date', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    expandDue();
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: 'whenever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/date like/i);
  });

  it('exposes make-project and move-to when wired', () => {
    const onMakeProject = vi.fn();
    const onMove = vi.fn();
    render(
      <ActionDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onMakeProject={onMakeProject}
        moveTargets={[{ id: 'p1', label: 'Home' }]}
        onMove={onMove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move / make project' })); // expand the section
    fireEvent.click(screen.getByRole('button', { name: 'Make project' }));
    expect(onMakeProject).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Move to'), { target: { value: 'p1' } });
    expect(onMove).toHaveBeenCalledWith('p1');
  });

  it('manages prerequisites and shows would-unblock', () => {
    const onAddPrerequisite = vi.fn();
    const onRemovePrerequisite = vi.fn();
    render(
      <ActionDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        blockers={[{ id: 'b1', title: 'Prep', done: false }]}
        blockerCandidates={[{ id: 'c1', label: 'Other task' }]}
        wouldUnblock={['Ship it']}
        onAddPrerequisite={onAddPrerequisite}
        onRemovePrerequisite={onRemovePrerequisite}
      />,
    );
    expect(screen.getByText('Would unblock: Ship it')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove prerequisite Prep' }));
    expect(onRemovePrerequisite).toHaveBeenCalledWith('b1');
    fireEvent.change(screen.getByLabelText('Add prerequisite'), { target: { value: 'c1' } });
    expect(onAddPrerequisite).toHaveBeenCalledWith('c1');
  });

  it('deletes a project directly (the advanced-delete dialog confirms), with an "Edit project" title', () => {
    const onDelete = vi.fn();
    render(
      <ActionDialog
        node={node({ project: true, title: 'Roof' })}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Edit project')).toBeInTheDocument();
    // Projects skip the inline confirm — Delete invokes onDelete (which opens the advanced dialog).
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('cancels the inline delete confirm without deleting (action)', () => {
    const onDelete = vi.fn();
    render(
      <ActionDialog node={node({ title: 'Tidy' })} open onOpenChange={vi.fn()} onSave={vi.fn()} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' })); // arm inline confirm (actions)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();
    // Back to the normal footer: Delete is available again.
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('omits the Delete button when not wired', () => {
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('adds a resource (via the #720 dialog) and reports it on save', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resources' })); // expand the section
    fireEvent.click(screen.getByRole('button', { name: 'Add resource…' }));
    fireEvent.change(screen.getByLabelText('Resource value'), { target: { value: 'https://docs.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    // The nested form's submit must NOT reach the editor's form (the portal-bubbling guard) —
    // the editor stays open, nothing saved yet.
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ resources: [{ type: 'URI', value: 'https://docs.test', description: null }] }),
    );
  });

  it('seeds existing resources and removes one', () => {
    const onSave = vi.fn();
    render(
      <ActionDialog
        node={node({ resources: [{ type: 'URI', value: 'https://keep.test', description: null }, { type: 'TEXT', value: 'drop me', description: null }] })}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove resource drop me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ resources: [{ type: 'URI', value: 'https://keep.test', description: null }] }),
    );
  });

  it('collapses the occasional sections by default, expanding on click', () => {
    render(
      <ActionDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onMakeProject={vi.fn()}
        moveTargets={[{ id: 'p1', label: 'Home' }]}
        onMove={vi.fn()}
      />,
    );
    // Resources / Move section controls are hidden until their disclosure is opened, so the
    // common fields + Save stay together at the top.
    expect(screen.queryByRole('button', { name: 'Add resource…' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make project' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resources' }));
    expect(screen.getByRole('button', { name: 'Add resource…' })).toBeInTheDocument();
  });

  it('opens the Blocked-by section by default when the action already has prerequisites', () => {
    render(
      <ActionDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        blockers={[{ id: 'b1', title: 'Prep', done: false }]}
        onAddPrerequisite={vi.fn()}
        onRemovePrerequisite={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Remove prerequisite Prep' })).toBeInTheDocument();
  });

  it('does not save with an empty title', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
