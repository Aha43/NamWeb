import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode } from '@/domain/types';
import { ActionDialog } from './ActionDialog';

function node(partial: Partial<NamNode> = {}): NamNode {
  return {
    id: 'a', title: 'Buy milk', description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
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
    expect(screen.getByLabelText('Due')).toHaveValue('2026-07-01');
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
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Due time (optional)'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Due end (optional)'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Due end time (optional)'), { target: { value: '17:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: '2026-08-12', dueTime: '09:00', dueEndAt: '2026-08-12', dueEndTime: '17:30' }),
    );
  });

  it('drops an end time when there is no end date (#500)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No end' } });
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Due end time (optional)'), { target: { value: '17:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueEndAt: null, dueEndTime: null }));
  });

  it('saves a time of day on the start, parsed from a bare hour (#493)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Doctor' } });
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Due time (optional)'), { target: { value: '14:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueAt: '2026-08-12', dueTime: '14:30' }));
  });

  it('drops a time when there is no date (#493)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No date' } });
    fireEvent.change(screen.getByLabelText('Due time (optional)'), { target: { value: '14:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueAt: null, dueTime: null }));
  });

  it('saves a due date range (start + end) via dueEndAt (#438)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Trip' } });
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
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueAt: null, dueEndAt: null }));
  });

  it('rejects an end date before the start (no save) (#438)', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Trip' } });
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-08-16' } });
    fireEvent.change(screen.getByLabelText('Due end (optional)'), { target: { value: '2026-08-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('echoes a canonical ISO due date on blur, leaving invalid text untouched', () => {
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={vi.fn()} />);
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

  it('adds a resource and reports it on save', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resources' })); // expand the section
    fireEvent.change(screen.getByLabelText('Resource value'), { target: { value: 'https://docs.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
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
    expect(screen.queryByLabelText('Resource value')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make project' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resources' }));
    expect(screen.getByLabelText('Resource value')).toBeInTheDocument();
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
