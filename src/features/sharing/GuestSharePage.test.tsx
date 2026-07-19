import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareContent } from '@/domain/shareContent';

const fetchGuestShare = vi.fn();
const submitSuggestion = vi.fn();
const fetchShareResourceEvents = vi.fn();
const submitResourceEvent = vi.fn();
const submitAnswerEvent = vi.fn();
vi.mock('./shares', async (orig) => ({
  ...(await orig<typeof import('./shares')>()),
  fetchGuestShare: (...a: unknown[]) => fetchGuestShare(...a),
  submitSuggestion: (...a: unknown[]) => submitSuggestion(...a),
  fetchShareResourceEvents: (...a: unknown[]) => fetchShareResourceEvents(...a),
  submitResourceEvent: (...a: unknown[]) => submitResourceEvent(...a),
  submitAnswerEvent: (...a: unknown[]) => submitAnswerEvent(...a),
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
  fetchShareResourceEvents.mockReset().mockResolvedValue([]);
  submitResourceEvent.mockReset().mockResolvedValue(true);
  submitAnswerEvent.mockReset().mockResolvedValue(true);
});

describe('GuestSharePage (#761)', () => {
  it('renders the itinerary: masthead, sections, items, friendly dates, done marks', async () => {
    fetchGuestShare.mockResolvedValue(CONTENT);
    render(<GuestSharePage token="tok123" />);

    expect(await screen.findByRole('heading', { name: 'Asia round trip', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('A year in the making.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Japan leg/, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tokyo days/, level: 3 })).toBeInTheDocument(); // nested section
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

  it('a sectioned share leads with a Contents nav anchored to the sections (#792)', async () => {
    fetchGuestShare.mockResolvedValue(CONTENT);
    render(<GuestSharePage token="tok123" />);
    const toc = await screen.findByRole('navigation', { name: 'Contents' });
    const link = within(toc).getByRole('link', { name: /Japan leg/ });
    expect(link).toHaveAttribute('href', '#cc33'); // the stage-1 pseudonymous id as anchor
    expect(document.getElementById('cc33')).not.toBeNull(); // and the target exists
  });

  it('a section-less share shows no Contents nav (#792)', async () => {
    fetchGuestShare.mockResolvedValue({ ...CONTENT, sections: [] });
    render(<GuestSharePage token="tok123" />);
    await screen.findByRole('heading', { name: 'Asia round trip' });
    expect(screen.queryByRole('navigation', { name: 'Contents' })).not.toBeInTheDocument();
  });

  it('sections open COLLAPSED (#826) and fold honestly both ways (#794)', async () => {
    fetchGuestShare.mockResolvedValue(CONTENT);
    render(<GuestSharePage token="tok123" />);
    await screen.findByRole('heading', { name: 'Asia round trip' });

    // Closed on arrival (#826): the TOC is the front door; root items stay visible.
    expect(screen.getByText('Book flights')).toBeVisible();
    const header = screen.getByRole('button', { name: /Japan leg/ });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('guest-section-cc33')).toHaveClass('hidden');
    // Honest collapsed header: date span + content count still shown.
    expect(header).toHaveTextContent(/Jun 10, 2027/);
    expect(header).toHaveTextContent('2 inside'); // one item + one nested section

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('guest-section-cc33')).not.toHaveClass('hidden');
    expect(screen.getByText('Ryokan night')).toBeVisible();
    // The nested section inside opened its OWN fold closed (#826 covers every depth).
    expect(screen.getByRole('button', { name: /Tokyo days/ })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(header);
    expect(document.getElementById('guest-section-cc33')).toHaveClass('hidden');
  });

  it('a #shared-open section renders EXPANDED on arrival while siblings stay folded (#838)', async () => {
    fetchGuestShare.mockResolvedValue({
      ...CONTENT,
      sections: [
        { ...CONTENT.sections[0], open: true }, // Japan leg pinned open
        { id: 'ff66', title: 'Canada alt', items: [{ id: 'gg77', title: 'Rockies' }], sections: [] },
      ],
    });
    render(<GuestSharePage token="tok123" />);
    await screen.findByRole('heading', { name: 'Asia round trip' });
    // The open section is expanded on arrival — its content is visible, header aria-expanded.
    expect(screen.getByRole('button', { name: /Japan leg/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Ryokan night')).toBeVisible();
    // A sibling without the tag still opens collapsed (#826).
    expect(screen.getByRole('button', { name: /Canada alt/ })).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('guest-section-ff66')).toHaveClass('hidden');
  });

  it('a TOC tap into a collapsed section expands it — deep links never dead-end (#794)', async () => {
    fetchGuestShare.mockResolvedValue(CONTENT);
    render(<GuestSharePage token="tok123" />);
    await screen.findByRole('heading', { name: 'Asia round trip' });
    expect(document.getElementById('guest-section-cc33')).toHaveClass('hidden'); // closed on arrival (#826)

    const toc = within(screen.getByRole('navigation', { name: 'Contents' }));
    fireEvent.click(toc.getByRole('link', { name: /Japan leg/ }));
    expect(document.getElementById('guest-section-cc33')).not.toHaveClass('hidden');
  });

  it('arriving with a #hash reveals the target through collapsed ancestors (#794, stage-4 ready)', async () => {
    window.location.hash = '#dd44'; // an ITEM inside the Japan leg
    fetchGuestShare.mockResolvedValue(CONTENT);
    render(<GuestSharePage token="tok123" />);
    await screen.findByRole('heading', { name: 'Asia round trip' });
    // The ancestor section is expanded on arrival (default is expanded anyway — so assert the
    // machinery: collapse, re-trigger reveal via the effect's helper path through the TOC).
    expect(screen.getByRole('button', { name: /Japan leg/ })).toHaveAttribute('aria-expanded', 'true');
    window.location.hash = '';
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

  it('the suggestion box captures: name + text → RPC → thanks; failure is quiet (#796)', async () => {
    fetchGuestShare.mockResolvedValue(CONTENT);
    submitSuggestion.mockResolvedValueOnce(true);
    render(<GuestSharePage token="tok123" />);
    await screen.findByRole('heading', { name: 'Asia round trip' });

    const send = screen.getByRole('button', { name: 'Send suggestion' });
    expect(send).toBeDisabled(); // empty guard
    fireEvent.change(screen.getByLabelText('Your name (optional)'), { target: { value: 'Anna' } });
    fireEvent.change(screen.getByLabelText('Your suggestion'), { target: { value: 'Ryokan night in Hakone?' } });
    fireEvent.click(send);
    await waitFor(() => expect(screen.getByText('Sent — thank you!')).toBeInTheDocument());
    expect(submitSuggestion).toHaveBeenCalledWith('tok123', 'Ryokan night in Hakone?', 'Anna');

    // Send another resets the text, keeps the name.
    fireEvent.click(screen.getByRole('button', { name: 'Send another' }));
    expect(screen.getByLabelText('Your suggestion')).toHaveValue('');
    expect(screen.getByLabelText('Your name (optional)')).toHaveValue('Anna');

    // A rejected capture (revoked link / over cap) reads as a quiet failure.
    submitSuggestion.mockResolvedValueOnce(false);
    fireEvent.change(screen.getByLabelText('Your suggestion'), { target: { value: 'Another idea' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }));
    await waitFor(() => expect(screen.getByText(/Couldn't send right now/)).toBeInTheDocument());
  });

  it('delegated counters (#810): overlaid pill, ticks through the RPC, quiet refusal', async () => {
    fetchGuestShare.mockResolvedValue({
      ...CONTENT,
      items: [{ id: 'aa11', title: 'Keep jars stocked', counters: [{ index: 1, value: '3/12', label: 'jars' }] }],
    });
    // One undrained event already queued by another guest: the overlay adds it.
    fetchShareResourceEvents.mockResolvedValue([{ node_id: 'aa11', res_index: 1, delta: 1 }]);
    render(<GuestSharePage token="tok123" />);

    expect(await screen.findByText(/jars 4\/12/)).toBeInTheDocument(); // 3 snapshot + 1 event
    fireEvent.click(screen.getByRole('button', { name: 'Count one on jars' }));
    await waitFor(() => expect(submitResourceEvent).toHaveBeenCalledWith('tok123', 'aa11', 1, 1));
    expect(await screen.findByText(/jars 5\/12/)).toBeInTheDocument(); // the accepted tick lands

    // A refused tick (revoked link / over cap) quietly doesn't move.
    submitResourceEvent.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Count one on jars' }));
    await waitFor(() => expect(submitResourceEvent).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/jars 5\/12/)).toBeInTheDocument();
  });

  it('got-it (#817): an item reads done in the aisle once its counters meet their goals', async () => {
    fetchGuestShare.mockResolvedValue({
      ...CONTENT,
      items: [{ id: 'aa11', title: 'Buy beans', counters: [{ index: 0, value: '1/2', label: 'boxes' }] }],
    });
    render(<GuestSharePage token="tok123" />);
    expect(await screen.findByText('Buy beans')).not.toHaveClass('line-through');
    fireEvent.click(screen.getByRole('button', { name: 'Count one on boxes' }));
    await waitFor(() => expect(screen.getByText('Buy beans')).toHaveClass('line-through'));
    // And stepping back down un-does the aisle read — live, no republish.
    fireEvent.click(screen.getByRole('button', { name: 'Count one off boxes' }));
    await waitFor(() => expect(screen.getByText('Buy beans')).not.toHaveClass('line-through'));
  });

  it('coming back to the tab re-pulls the other shoppers\' ticks (#821/F4)', async () => {
    fetchGuestShare.mockResolvedValue({
      ...CONTENT,
      items: [{ id: 'aa11', title: 'Buy milk', counters: [{ index: 0, value: '0/4', label: 'cartons' }] }],
    });
    render(<GuestSharePage token="tok123" />);
    expect(await screen.findByText(/cartons 0\/4/)).toBeInTheDocument();
    // Another guest bought two while this phone was pocketed.
    fetchShareResourceEvents.mockResolvedValue([
      { node_id: 'aa11', res_index: 0, delta: 1 },
      { node_id: 'aa11', res_index: 0, delta: 1 },
    ]);
    fireEvent(window, new Event('focus'));
    expect(await screen.findByText(/cartons 2\/4/)).toBeInTheDocument();
  });

  it('delegated questions (#827): overlay answer, tap to answer, quiet refusal', async () => {
    fetchGuestShare.mockResolvedValue({
      ...CONTENT,
      items: [{ id: 'aa11', title: 'Camp', questions: [{ index: 0, question: 'Bringing a tent?', value: '?' }] }],
    });
    // Another guest already answered yes.
    fetchShareResourceEvents.mockResolvedValue([{ node_id: 'aa11', res_index: 0, delta: null, answer: 'yes' }]);
    render(<GuestSharePage token="tok123" />);
    const yes = await screen.findByRole('button', { name: 'Answer yes: Bringing a tent?' });
    expect(yes).toHaveAttribute('aria-pressed', 'true'); // overlaid from the event
    // Change it to no.
    fireEvent.click(screen.getByRole('button', { name: 'Answer no: Bringing a tent?' }));
    await waitFor(() => expect(submitAnswerEvent).toHaveBeenCalledWith('tok123', 'aa11', 0, 'no'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Answer no: Bringing a tent?' })).toHaveAttribute('aria-pressed', 'true'));
  });

  it('a local tick keeps a concurrent refresh\'s fresh answer (#832/P2)', async () => {
    let resolveRefresh: (v: unknown) => void = () => {};
    fetchGuestShare.mockResolvedValue({
      ...CONTENT,
      items: [{
        id: 'aa11', title: 'Camp',
        counters: [{ index: 0, value: '0/4', label: 'cartons' }],
        questions: [{ index: 1, question: 'Tent?', value: '?' }],
      }],
    });
    fetchShareResourceEvents.mockResolvedValueOnce([]); // initial load: empty
    render(<GuestSharePage token="tok123" />);
    await screen.findByText(/cartons 0\/4/);
    // A focus-refresh begins carrying another guest's fresh answer…
    fetchShareResourceEvents.mockImplementationOnce(() => new Promise((r) => { resolveRefresh = r; }));
    fireEvent(window, new Event('focus'));
    // …and a local counter tick lands before it resolves.
    fireEvent.click(screen.getByRole('button', { name: 'Count one on cartons' }));
    await waitFor(() => expect(screen.getByText(/cartons 1\/4/)).toBeInTheDocument());
    resolveRefresh([{ node_id: 'aa11', res_index: 1, delta: null, answer: 'yes' }]);
    // The tick survives (its generation bumped), AND the unrelated fresh answer still applies.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Answer yes: Tent?' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByText(/cartons 1\/4/)).toBeInTheDocument();
  });

  it('an undelegated page never fetches the overlay (#810)', async () => {
    fetchGuestShare.mockResolvedValue(CONTENT);
    render(<GuestSharePage token="tok123" />);
    await screen.findByRole('heading', { name: 'Asia round trip', level: 1 });
    expect(fetchShareResourceEvents).not.toHaveBeenCalled();
  });

  it('shows nothing NAM-flavored while loading', () => {
    fetchGuestShare.mockReturnValue(new Promise(() => {}));
    render(<GuestSharePage token="tok123" />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText(/sign/i)).not.toBeInTheDocument();
  });
});
