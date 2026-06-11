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
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks save and flags an invalid due date', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: 'whenever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/date like/i);
  });

  it('does not save with an empty title', () => {
    const onSave = vi.fn();
    render(<ActionDialog node={node()} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
