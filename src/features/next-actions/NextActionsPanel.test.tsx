import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import { NextActionsPanel } from './NextActionsPanel';

function row(overrides: Partial<ActionRowData> = {}): ActionRowData {
  return { id: 'a', title: 'Buy milk', path: [], tags: [], dueAt: null, touchedAt: null, ...overrides };
}

function setup(rows: ActionRowData[]) {
  const handlers = { onMarkDone: vi.fn(), onMarkBacklog: vi.fn(), onRename: vi.fn() };
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
    // 2026-03-20 is well in the past → overdue short-date label, not raw ISO.
    expect(screen.getByText('Due Mar 20')).toBeInTheDocument();
  });

  it('marks done and sends to backlog by id', () => {
    const { onMarkDone, onMarkBacklog } = setup([row({ id: 'x', title: 'Buy milk' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Buy milk done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Buy milk to backlog' }));
    expect(onMarkDone).toHaveBeenCalledWith('x');
    expect(onMarkBacklog).toHaveBeenCalledWith('x');
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
