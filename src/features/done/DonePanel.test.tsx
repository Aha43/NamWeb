import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import { DonePanel } from './DonePanel';

function row(overrides: Partial<ActionRowData> = {}): ActionRowData {
  return { id: 'a', title: 'Buy milk', description: null, status: 'DONE', path: [], tags: [], dueAt: null, touchedAt: null, ...overrides };
}

describe('DonePanel', () => {
  it('shows the empty state with no rows', () => {
    render(<DonePanel rows={[]} onRestore={vi.fn()} onBacklog={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Nothing done yet')).toBeInTheDocument();
  });

  it('restores, backlogs, and deletes by id', () => {
    const handlers = { onRestore: vi.fn(), onBacklog: vi.fn(), onDelete: vi.fn() };
    render(<DonePanel rows={[row({ id: 'x', title: 'Buy milk' })]} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore Buy milk to next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Buy milk to backlog' }));
    // Delete is a confirm popover: open it, then confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Delete Buy milk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(handlers.onRestore).toHaveBeenCalledWith('x');
    expect(handlers.onBacklog).toHaveBeenCalledWith('x');
    expect(handlers.onDelete).toHaveBeenCalledWith('x');
  });

  it('bulk-restores selected rows in select mode', () => {
    const handlers = { onRestore: vi.fn(), onBacklog: vi.fn(), onDelete: vi.fn() };
    render(<DonePanel rows={[row({ id: 'a', title: 'One' }), row({ id: 'b', title: 'Two' })]} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select actions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select One' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Two' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore to Next' }));
    expect(handlers.onRestore).toHaveBeenCalledWith('a');
    expect(handlers.onRestore).toHaveBeenCalledWith('b');
  });
});
