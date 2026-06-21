import { render, screen, fireEvent } from '@testing-library/react';
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

  it('inline-renames a sub-project column header (not the Unsorted column)', () => {
    const { onRename } = setup();
    expect(screen.queryByRole('button', { name: /Rename Unsorted/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rename Phase 1' }));
    const input = screen.getByLabelText('Rename Phase 1');
    fireEvent.change(input, { target: { value: 'Phase one' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('s1', 'Phase one');
  });

  it('shows a delete (trash) button per card and fires onDelete after confirm', () => {
    const onDelete = vi.fn();
    setup({ onDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' })); // open confirm popover
    fireEvent.click(screen.getByRole('button', { name: 'Delete' })); // confirm
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('has no delete button when onDelete is not provided', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Delete Alpha' })).not.toBeInTheDocument();
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

  it('renders a resize handle per column when wired; arrow keys nudge the width', () => {
    const onSetColumnWidth = vi.fn();
    setup({ onSetColumnWidth, columnWidths: { p: 300 } });
    const handle = screen.getByRole('separator', { name: 'Resize Unsorted column' });
    expect(handle).toHaveAttribute('aria-valuenow', '300');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onSetColumnWidth).toHaveBeenCalledWith('p', 316);
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onSetColumnWidth).toHaveBeenCalledWith('p', 284);
  });

  it('uses the default width and resets on double-click', () => {
    const onResetColumnWidth = vi.fn();
    setup({ onSetColumnWidth: vi.fn(), onResetColumnWidth });
    const handle = screen.getByRole('separator', { name: 'Resize Phase 1 column' });
    expect(handle).toHaveAttribute('aria-valuenow', '256'); // default when no stored width
    fireEvent.doubleClick(handle);
    expect(onResetColumnWidth).toHaveBeenCalledWith('s1');
  });

  it('has no resize handle when width control is not wired', () => {
    setup();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('offers left/right column-move buttons on sub-projects (not Unsorted), with ends disabled', () => {
    const onMoveColumn = vi.fn();
    const threeColumns: WorkbenchColumn[] = [
      { id: 'p', title: 'Project', isUnsorted: true, actions: [] },
      { id: 's1', title: 'Phase 1', isUnsorted: false, actions: [] },
      { id: 's2', title: 'Phase 2', isUnsorted: false, actions: [] },
    ];
    render(
      <ColumnView
        columns={threeColumns}
        onOpenColumn={vi.fn()} onAddAction={vi.fn()} onMoveAction={vi.fn()}
        onSetStatus={vi.fn()} onEdit={vi.fn()} onRename={vi.fn()}
        onMoveColumn={onMoveColumn}
      />,
    );
    // Unsorted has no move buttons.
    expect(screen.queryByRole('button', { name: /Move Project (left|right)/i })).not.toBeInTheDocument();
    // First sub-project: left disabled, right enabled.
    expect(screen.getByRole('button', { name: 'Move Phase 1 left' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Phase 1 right' })).toBeEnabled();
    // Last sub-project: right disabled.
    expect(screen.getByRole('button', { name: 'Move Phase 2 right' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Move Phase 1 right' }));
    expect(onMoveColumn).toHaveBeenCalledWith('s1', 'right');
  });
});
