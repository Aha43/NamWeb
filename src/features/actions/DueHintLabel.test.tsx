import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DueHintLabel } from './DueHintLabel';

describe('DueHintLabel', () => {
  it('renders nothing without a due date', () => {
    const { container } = render(<DueHintLabel dueAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an overdue date with the warning tone', () => {
    render(<DueHintLabel dueAt="2026-03-20" />); // well in the past
    // The tone rides the outer span; the start segment is an inner span (#706 split the edges).
    expect(screen.getByText('Due Mar 20, 2026').parentElement).toHaveClass('text-red-600');
  });

  it('appends range and times when present', () => {
    render(<DueHintLabel dueAt="2026-03-20" dueEndAt="2026-03-22" dueTime="09:00" dueEndTime="17:00" />);
    const start = screen.getByText('Due Mar 20, 2026 09:00');
    expect(start.parentElement).toHaveTextContent('Due Mar 20, 2026 09:00 – Mar 22, 2026 17:00');
  });

  it('ignores an end date before the start (defensive, matches ActionRow)', () => {
    render(<DueHintLabel dueAt="2026-03-20" dueEndAt="2026-03-01" dueEndTime="17:00" />);
    expect(screen.getByText('Due Mar 20, 2026')).toBeInTheDocument();
  });

  it('renders derived edges italic (#706)', () => {
    render(<DueHintLabel dueAt="2026-03-20" dueEndAt="2026-03-22" derivedEnd />);
    // The start segment stays upright, the derived end goes italic.
    expect(screen.getByText('Due Mar 20, 2026')).not.toHaveClass('italic');
    expect(screen.getByText(/– Mar 22, 2026/)).toHaveClass('italic');
  });
});
