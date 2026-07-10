import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CollapsedDue } from './CollapsedDue';

describe('CollapsedDue (#721)', () => {
  it('shows the set time densely with an edit affordance; expanding reveals the controls', () => {
    render(
      <CollapsedDue fields={{ dueAt: '2026-03-20', dueEndAt: '2026-03-22' }}>
        <div>the full controls</div>
      </CollapsedDue>,
    );
    expect(screen.getByText('Due Mar 20, 2026')).toBeInTheDocument();
    expect(screen.queryByText('the full controls')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit due date' }));
    expect(screen.getByText('the full controls')).toBeInTheDocument();
    expect(screen.queryByText('Due Mar 20, 2026')).not.toBeInTheDocument();
  });

  it('the render-prop collapse goes back to the dense line — expand/collapse is symmetric', () => {
    render(
      <CollapsedDue fields={{ dueAt: '2026-03-20' }}>
        {(collapse) => (
          <button type="button" onClick={collapse}>
            back to one line
          </button>
        )}
      </CollapsedDue>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit due date' }));
    fireEvent.click(screen.getByRole('button', { name: 'back to one line' }));
    expect(screen.getByText('Due Mar 20, 2026')).toBeInTheDocument();
  });

  it('forceExpand opens the block so a validation alert cannot hide behind the dense line (#724)', () => {
    const { rerender } = render(
      <CollapsedDue fields={{ dueAt: null }} forceExpand={false}>
        <div>the full controls</div>
      </CollapsedDue>,
    );
    expect(screen.queryByText('the full controls')).not.toBeInTheDocument();
    rerender(
      <CollapsedDue fields={{ dueAt: null }} forceExpand>
        <div>the full controls</div>
      </CollapsedDue>,
    );
    expect(screen.getByText('the full controls')).toBeInTheDocument();
  });

  it('offers "＋ Add due date" when nothing is set', () => {
    render(
      <CollapsedDue fields={{ dueAt: null }}>
        <div>the full controls</div>
      </CollapsedDue>,
    );
    fireEvent.click(screen.getByRole('button', { name: '＋ Add due date' }));
    expect(screen.getByText('the full controls')).toBeInTheDocument();
  });

  it('renders derived edges italic in the dense display (#706)', () => {
    render(
      <CollapsedDue fields={{ dueAt: '2026-03-20', dueEndAt: '2026-03-25', derivedEnd: true }}>
        <div />
      </CollapsedDue>,
    );
    expect(screen.getByText(/– Mar 25, 2026/)).toHaveClass('italic');
  });
});
