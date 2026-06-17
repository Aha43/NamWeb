import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import { NextActionsPanel } from './NextActionsPanel';

function row(overrides: Partial<ActionRowData> = {}): ActionRowData {
  return { id: 'a', title: 'Buy milk', status: 'NEXT', path: [], tags: [], dueAt: null, touchedAt: null, ...overrides };
}

function setup(rows: ActionRowData[]) {
  const handlers = { onSetStatus: vi.fn(), onRename: vi.fn() };
  render(<NextActionsPanel rows={rows} {...handlers} />);
  return handlers;
}

describe('NextActionsPanel', () => {
  it('shows the empty state with no rows', () => {
    setup([]);
    expect(screen.getByText('No next actions.')).toBeInTheDocument();
  });

  it('renders title, project path, tags, and a formatted due hint', () => {
    setup([row({ title: 'Get quotes', path: ['Home', 'Kitchen'], tags: ['@phone'], dueAt: '2026-03-20' })]);
    expect(screen.getByText('Get quotes')).toBeInTheDocument();
    expect(screen.getByText('Home › Kitchen')).toBeInTheDocument();
    expect(screen.getByText('@phone')).toBeInTheDocument();
    // 2026-03-20 is well in the past → overdue date label (default Medium format).
    expect(screen.getByText('Due Mar 20, 2026')).toBeInTheDocument();
  });

  it('renders a status control for each row', () => {
    setup([row({ id: 'x', title: 'Buy milk' })]);
    expect(screen.getByRole('button', { name: /status of Buy milk/i })).toBeInTheDocument();
  });

  it('shows the sort toggle and cycles it', () => {
    const onCycleSort = vi.fn();
    render(
      <NextActionsPanel rows={[row()]} onSetStatus={vi.fn()} sortMode="fifo" onCycleSort={onCycleSort} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /sort: oldest/i }));
    expect(onCycleSort).toHaveBeenCalledOnce();
  });

  it('quick-adds a next action via the input (trimmed) and clears it', () => {
    const onAdd = vi.fn();
    render(<NextActionsPanel rows={[]} onSetStatus={vi.fn()} onAdd={onAdd} />);
    const input = screen.getByLabelText('Add a next action');
    fireEvent.change(input, { target: { value: '  Call plumber  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('Call plumber');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('has no add input when onAdd is not provided', () => {
    setup([row()]);
    expect(screen.queryByLabelText('Add a next action')).not.toBeInTheDocument();
  });

  it('renames inline on double-click + Enter', () => {
    const { onRename } = setup([row({ id: 'x', title: 'Buy milk' })]);
    fireEvent.doubleClick(screen.getByText('Buy milk'));
    const input = screen.getByLabelText('Rename Buy milk');
    fireEvent.change(input, { target: { value: 'Buy oat milk' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('x', 'Buy oat milk');
  });
});
