import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareContent } from '@/domain/shareContent';

const fetchGuestShare = vi.fn();
vi.mock('./shares', async (orig) => ({
  ...(await orig<typeof import('./shares')>()),
  fetchGuestShare: (...a: unknown[]) => fetchGuestShare(...a),
}));

import { GuestSharePage } from './GuestSharePage';

const CONTENT: ShareContent = {
  version: 1,
  title: 'Asia round trip',
  note: 'A year in the making.',
  due: { start: '2027-06-01', end: '2027-07-04' },
  publishedAt: '2026-07-13T12:00:00.000Z',
  items: [
    { id: 'aa11', title: 'Book flights', due: { start: '2027-06-01' }, note: 'via Doha?' },
    { id: 'bb22', title: 'Passports checked', done: true },
  ],
  sections: [
    {
      id: 'cc33',
      title: 'Japan leg',
      due: { start: '2027-06-10', end: '2027-06-20' },
      items: [{ id: 'dd44', title: 'Ryokan night', due: { start: '2027-06-12', startTime: '15:00' } }],
      sections: [{ id: 'ee55', title: 'Tokyo days', items: [], sections: [] }],
    },
  ],
};

beforeEach(() => {
  // Braces matter: a function RETURNED from beforeEach is a vitest teardown callback — the
  // bare arrow returned the mock itself, which vitest then called and awaited (10s timeout).
  fetchGuestShare.mockReset();
});

describe('GuestSharePage (#761)', () => {
  it('renders the itinerary: masthead, sections, items, friendly dates, done marks', async () => {
    fetchGuestShare.mockResolvedValue(CONTENT);
    render(<GuestSharePage token="tok123" />);

    expect(await screen.findByRole('heading', { name: 'Asia round trip', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('A year in the making.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Japan leg', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tokyo days', level: 3 })).toBeInTheDocument(); // nested section
    expect(screen.getByText('Book flights')).toBeInTheDocument();
    expect(screen.getByText('via Doha?')).toBeInTheDocument();
    // A done item renders struck-through (progress included in this snapshot).
    expect(screen.getByText('Passports checked')).toHaveClass('line-through');
    // Friendly Intl dates, with time when present (en locale in tests).
    expect(screen.getByText(/Jun 12, 2027 15:00/)).toBeInTheDocument();
    // Guest ids are DOM anchors (stage 4 will address them).
    expect(document.getElementById('dd44')).not.toBeNull();
    // The tab is the project (polled: the title effect flushes a beat after the content).
    await waitFor(() => expect(document.title).toBe('Asia round trip'));
    // No search engine ever sees it.
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
    // The quiet funnel.
    expect(screen.getByText('Shared from')).toBeInTheDocument();
  });

  it('unknown/revoked/failed all land on the same quiet gone state, with retry', async () => {
    fetchGuestShare.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(CONTENT);
    render(<GuestSharePage token="tok123" />);

    expect(await screen.findByText('This link is no longer active')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' })); // network error → same state
    expect(await screen.findByText('This link is no longer active')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' })); // third time lucky
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Asia round trip' })).toBeInTheDocument());
  });

  it('shows nothing NAM-flavored while loading', () => {
    fetchGuestShare.mockReturnValue(new Promise(() => {}));
    render(<GuestSharePage token="tok123" />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText(/sign/i)).not.toBeInTheDocument();
  });
});
