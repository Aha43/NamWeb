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
      status: 'NEXT',
      resources: [],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
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

  it('shows a Delete button (when wired) and an "Edit project" title for projects', () => {
    const onDelete = vi.fn();
    render(
      <ActionDialog node={node({ project: true, title: 'Roof' })} open onOpenChange={vi.fn()} onSave={vi.fn()} onDelete={onDelete} />,
    );
    expect(screen.getByText('Edit project')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('omits the Delete button when not wired', () => {
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('adds a resource and reports it on save', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
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

  it('does not save with an empty title', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
