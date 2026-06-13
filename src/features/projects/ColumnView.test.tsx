import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import { ColumnView, type WorkbenchColumn } from './ColumnView';

function actionRow(id: string, title: string): ActionRowData {
  return { id, title, status: 'NEXT', path: [], tags: [], dueAt: null, touchedAt: null };
}

const columns: WorkbenchColumn[] = [
  { id: 'p', title: 'Project', isUnsorted: true, actions: [actionRow('a', 'Alpha'), actionRow('b', 'Beta')] },
  { id: 's1', title: 'Phase 1', isUnsorted: false, actions: [] },
];

function setup(over: Partial<React.ComponentProps<typeof ColumnView>> = {}) {
  const handlers = {
    onOpenColumn: vi.fn(), onAddAction: vi.fn(), onMoveAction: vi.fn(),
    onSetStatus: vi.fn(), onEdit: vi.fn(), onRename: vi.fn(),
  };
  render(<ColumnView columns={columns} {...handlers} {...over} />);
  return handlers;
}

describe('ColumnView', () => {
  it('renders an Unsorted column plus one column per sub-project, with a quick-add each', () => {
    setup();
    expect(screen.getByText('Unsorted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Phase 1' })).toBeInTheDocument();
    expect(screen.getByLabelText('Add action to Unsorted')).toBeInTheDocument();
    expect(screen.getByLabelText('Add action to Phase 1')).toBeInTheDocument();
  });

  it('offers drag handles alongside the up/down buttons when drag is enabled', () => {
    setup({ dndEnabled: true, onMoveActionToColumn: vi.fn() });
    expect(screen.getByRole('button', { name: /Drag to reorder Alpha/i })).toBeInTheDocument();
    // The within-column buttons stay as the a11y fallback.
    expect(screen.getByRole('button', { name: /Move Alpha down/i })).toBeInTheDocument();
  });

  it('shows no drag handles when drag is disabled', () => {
    setup({ dndEnabled: false });
    expect(screen.queryByRole('button', { name: /Drag to reorder/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move Alpha down/i })).toBeInTheDocument();
  });
});
