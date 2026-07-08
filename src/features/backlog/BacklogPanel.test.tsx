import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import { BacklogPanel } from './BacklogPanel';

function row(overrides: Partial<ActionRowData> = {}): ActionRowData {
  return { id: 'a', title: 'Buy milk', description: null, status: 'BACKLOG', path: [], tags: [], dueAt: null, touchedAt: null, ...overrides };
}

describe('BacklogPanel', () => {
  it('shows the empty state with no rows', () => {
    render(<BacklogPanel rows={[]} onSetStatus={vi.fn()} />);
    expect(screen.getByText('Backlog is empty')).toBeInTheDocument();
  });

  it('pins the Focus entry point in the sticky header (#687)', () => {
    render(
      <BacklogPanel rows={[row()]} onSetStatus={vi.fn()} focusSlot={<button type="button">Focus me</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Focus me' }).closest('.sticky')).not.toBeNull();
  });

  it('renders rows with a status control', () => {
    render(<BacklogPanel rows={[row({ id: 'x', title: 'Buy milk' })]} onSetStatus={vi.fn()} />);
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /status of Buy milk/i })).toBeInTheDocument();
  });

  it('offers a drag handle alongside the up/down buttons when drag is enabled', () => {
    render(
      <BacklogPanel
        rows={[row({ id: 'x', title: 'Buy milk' }), row({ id: 'y', title: 'Call bank' })]}
        reorderable
        onMove={vi.fn()}
        onReorder={vi.fn()}
        dndEnabled
        onSetStatus={vi.fn()}
      />,
    );
    // Drag handle is added…
    expect(screen.getByRole('button', { name: /Drag to reorder Buy milk/i })).toBeInTheDocument();
    // …and the buttons stay as the a11y fallback.
    expect(screen.getByRole('button', { name: /Move Buy milk down/i })).toBeInTheDocument();
  });

  it('quick-adds a backlog action via the input (trimmed) and clears it', () => {
    const onAdd = vi.fn();
    render(<BacklogPanel rows={[]} onSetStatus={vi.fn()} onAdd={onAdd} />);
    const input = screen.getByLabelText('Add to backlog');
    fireEvent.change(input, { target: { value: '  Renew passport  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('Renew passport');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('has no add input when onAdd is not provided', () => {
    render(<BacklogPanel rows={[row()]} onSetStatus={vi.fn()} />);
    expect(screen.queryByLabelText('Add to backlog')).not.toBeInTheDocument();
  });

  it('shows no drag handle when drag is disabled (e.g. on mobile)', () => {
    render(
      <BacklogPanel
        rows={[row({ id: 'x', title: 'Buy milk' })]}
        reorderable
        onMove={vi.fn()}
        onReorder={vi.fn()}
        dndEnabled={false}
        onSetStatus={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Drag to reorder/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move Buy milk down/i })).toBeInTheDocument();
  });
});
