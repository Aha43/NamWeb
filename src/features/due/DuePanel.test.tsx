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
