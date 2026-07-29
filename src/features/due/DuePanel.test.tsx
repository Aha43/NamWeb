import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import { DuePanel, type DueRowGroups } from './DuePanel';

function row(id: string, title: string): ActionRowData {
  return { id, title, description: null, status: 'NEXT', path: [], tags: [], dueAt: '2026-06-01', touchedAt: null };
}

const EMPTY: DueRowGroups = { overdue: [], today: [], thisWeek: [], later: [] };

describe('DuePanel', () => {
  it('shows the empty state when nothing is due', () => {
    render(<DuePanel groups={EMPTY} onSetStatus={vi.fn()} />);
    expect(screen.getByText('Nothing due')).toBeInTheDocument();
  });

  it('keeps the filter controls and shows a filtered-empty message when a filter empties the list (#980)', () => {
    render(
      <DuePanel groups={EMPTY} onSetStatus={vi.fn()} filtered statusSlot={<div>status boxes</div>} />,
    );
    // The controls stay reachable (so you can un-filter), and the message says it's the filter's doing.
    expect(screen.getByText('status boxes')).toBeInTheDocument();
    expect(screen.getByText('Nothing due matches the current filter')).toBeInTheDocument();
    // Not the bare "nothing has a due date" state.
    expect(screen.queryByText('Nothing due')).not.toBeInTheDocument();
  });

  it('pins the Focus entry point in a sticky header (#687)', () => {
    render(
      <DuePanel
        groups={{ ...EMPTY, today: [row('t', 'Call back')] }}
        onSetStatus={vi.fn()}
        focusSlot={<button type="button">Focus me</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Focus me' }).closest('.sticky')).not.toBeNull();
  });

  it('renders only the non-empty sections', () => {
    render(
      <DuePanel
        groups={{ ...EMPTY, overdue: [row('o', 'Pay bill')], today: [row('t', 'Call back')] }}
        onSetStatus={vi.fn()}
      />,
    );
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Pay bill')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Call back')).toBeInTheDocument();
    expect(screen.queryByText('This week')).not.toBeInTheDocument();
    expect(screen.queryByText('Later')).not.toBeInTheDocument();
  });
});
