import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import { BlockedPanel, type BlockedRowGroup } from './BlockedPanel';

function row(id: string, title: string): ActionRowData {
  return { id, title, status: 'NEXT', path: [], tags: [], dueAt: null, touchedAt: null };
}

describe('BlockedPanel', () => {
  it('shows the empty state with no groups', () => {
    render(<BlockedPanel groups={[]} onOpenBlocker={vi.fn()} onSetStatus={vi.fn()} />);
    expect(screen.getByText('Nothing blocked')).toBeInTheDocument();
  });

  it('groups blocked actions under a blocker header that opens the blocker', () => {
    const onOpenBlocker = vi.fn();
    const groups: BlockedRowGroup[] = [{ blocker: { id: 'b', title: 'Prep' }, rows: [row('a', 'Wait task')] }];
    render(<BlockedPanel groups={groups} onOpenBlocker={onOpenBlocker} onSetStatus={vi.fn()} />);
    expect(screen.getByText('Blocked by: Prep')).toBeInTheDocument();
    expect(screen.getByText('Wait task')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open blocker Prep' }));
    expect(onOpenBlocker).toHaveBeenCalledWith('b');
  });
});
