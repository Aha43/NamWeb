import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import { BacklogPanel } from './BacklogPanel';

function row(overrides: Partial<ActionRowData> = {}): ActionRowData {
  return { id: 'a', title: 'Buy milk', status: 'BACKLOG', path: [], tags: [], dueAt: null, touchedAt: null, ...overrides };
}

describe('BacklogPanel', () => {
  it('shows the empty state with no rows', () => {
    render(<BacklogPanel rows={[]} onSetStatus={vi.fn()} />);
    expect(screen.getByText('Backlog is empty.')).toBeInTheDocument();
  });

  it('renders rows with a status control', () => {
    render(<BacklogPanel rows={[row({ id: 'x', title: 'Buy milk' })]} onSetStatus={vi.fn()} />);
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /status of Buy milk/i })).toBeInTheDocument();
  });
});
