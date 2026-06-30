import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarGrid } from './date-picker';

describe('CalendarGrid (#499)', () => {
  const today = new Date(2026, 5, 15); // 2026-06-15

  it('opens on the selected date and picks a day as ISO', () => {
    const onSelect = vi.fn();
    render(<CalendarGrid selected="2026-08-12" onSelect={onSelect} today={today} />);
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2026-08-20' }));
    expect(onSelect).toHaveBeenCalledWith('2026-08-20');
  });

  it('falls back to today’s month when nothing is selected, and navigates months', () => {
    render(<CalendarGrid selected={null} onSelect={vi.fn()} today={today} />);
    expect(screen.getByText('June 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('July 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('May 2026')).toBeInTheDocument();
  });

  it('marks the selected day as pressed', () => {
    render(<CalendarGrid selected="2026-06-10" onSelect={vi.fn()} today={today} />);
    expect(screen.getByRole('button', { name: '2026-06-10' })).toHaveAttribute('aria-pressed', 'true');
  });
});
