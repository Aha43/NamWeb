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
    const hint = screen.getByText('Due Mar 20, 2026');
    expect(hint).toHaveClass('text-red-600');
  });

  it('appends range and times when present', () => {
    render(<DueHintLabel dueAt="2026-03-20" dueEndAt="2026-03-22" dueTime="09:00" dueEndTime="17:00" />);
    expect(screen.getByText('Due Mar 20, 2026 09:00 – Mar 22, 2026 17:00')).toBeInTheDocument();
  });

  it('ignores an end date before the start (defensive, matches ActionRow)', () => {
    render(<DueHintLabel dueAt="2026-03-20" dueEndAt="2026-03-01" dueEndTime="17:00" />);
    expect(screen.getByText('Due Mar 20, 2026')).toBeInTheDocument();
  });
});
