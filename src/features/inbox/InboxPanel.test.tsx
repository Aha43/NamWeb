import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode } from '../../domain/types';
import { InboxPanel } from './InboxPanel';

function item(id: string, title: string): NamNode {
  return {
    id, title, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null,
  };
}

function setup(items: NamNode[] = []) {
  const handlers = { onAdd: vi.fn(), onProcess: vi.fn(), onDelete: vi.fn() };
  render(<InboxPanel items={items} {...handlers} />);
  return handlers;
}

describe('InboxPanel', () => {
  it('shows the empty state with no items', () => {
    setup([]);
    expect(screen.getByText(/inbox zero/i)).toBeInTheDocument();
  });

  it('lists items', () => {
    setup([item('a', 'Buy milk'), item('b', 'Call Sam')]);
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByText('Call Sam')).toBeInTheDocument();
  });

  it('captures a trimmed title and clears the field', () => {
    const { onAdd } = setup();
    const input = screen.getByLabelText('Quick add');
    fireEvent.change(input, { target: { value: '  Buy milk  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('Buy milk');
    expect(input).toHaveValue('');
  });

  it('ignores empty/whitespace capture', () => {
    const { onAdd } = setup();
    fireEvent.change(screen.getByLabelText('Quick add'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('processes and deletes by id', () => {
    const { onProcess, onDelete } = setup([item('a', 'Buy milk')]);
    fireEvent.click(screen.getByRole('button', { name: 'Process Buy milk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Buy milk' }));
    expect(onProcess).toHaveBeenCalledWith('a');
    expect(onDelete).toHaveBeenCalledWith('a');
  });
});
