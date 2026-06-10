import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import { BacklogPanel } from './BacklogPanel';

function row(overrides: Partial<ActionRowData> = {}): ActionRowData {
  return { id: 'a', title: 'Buy milk', path: [], tags: [], dueAt: null, ...overrides };
}

describe('BacklogPanel', () => {
  it('shows the empty state with no rows', () => {
    render(<BacklogPanel rows={[]} onPromote={vi.fn()} />);
    expect(screen.getByText('Backlog is empty.')).toBeInTheDocument();
  });

  it('renders rows and promotes by id', () => {
    const onPromote = vi.fn();
    render(<BacklogPanel rows={[row({ id: 'x', title: 'Buy milk' })]} onPromote={onPromote} />);
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Promote Buy milk to next' }));
    expect(onPromote).toHaveBeenCalledWith('x');
  });
});
