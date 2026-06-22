import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FocusCard } from './focusCards';
import { FocusDeck } from './FocusDeck';

function card(id: string, title: string): FocusCard {
  return { id, title, description: null, path: [] };
}

function setup(cards: FocusCard[]) {
  const handlers = { onDone: vi.fn(), onExit: vi.fn() };
  render(<FocusDeck cards={cards} {...handlers} />);
  return handlers;
}

const three = [card('a', 'Do A'), card('b', 'Do B'), card('c', 'Do C')];

describe('FocusDeck', () => {
  it('shows the first card and progress', () => {
    setup(three);
    expect(screen.getByRole('heading', { name: 'Do A' })).toBeInTheDocument();
    expect(screen.getByLabelText('Progress')).toHaveTextContent('1 / 3');
  });

  it('advances with Next and wraps Previous circularly', () => {
    setup(three);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Do B' })).toBeInTheDocument();
    expect(screen.getByLabelText('Progress')).toHaveTextContent('2 / 3');
  });

  it('wraps to the last card when going Previous from the first', () => {
    setup(three);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('heading', { name: 'Do C' })).toBeInTheDocument();
    expect(screen.getByLabelText('Progress')).toHaveTextContent('3 / 3');
  });

  it('marks the current card done', () => {
    const { onDone } = setup(three);
    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(onDone).toHaveBeenCalledWith('a');
  });

  it('supports keyboard: ArrowRight advances, Space marks done, Escape exits', () => {
    const { onDone, onExit } = setup(three);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Do B' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: ' ' });
    expect(onDone).toHaveBeenCalledWith('b');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('re-triages the current card via the flip button when wired', () => {
    const onFlip = vi.fn();
    render(<FocusDeck cards={three} onDone={vi.fn()} onExit={vi.fn()} flipLabel="Backlog" onFlip={onFlip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move to Backlog' }));
    expect(onFlip).toHaveBeenCalledWith('a');
  });

  it('omits the flip button when not wired (e.g. project-scoped focus)', () => {
    setup(three);
    expect(screen.queryByRole('button', { name: /^Move to/ })).not.toBeInTheDocument();
  });

  it('shows an empty-queue state that guides what to do next', () => {
    const { onExit } = setup([]);
    expect(screen.getByText('All clear 🎉')).toBeInTheDocument();
    expect(screen.getByText(/Capture a thought or move an action to Next/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('shows a touch hint by default (no keyboard on a phone)', () => {
    setup(three);
    expect(screen.getByText(/Swipe to move/)).toBeInTheDocument();
    expect(screen.queryByText(/Space to mark done/)).not.toBeInTheDocument();
  });

  it('shows the keyboard shortcuts on desktop', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) =>
      ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
    try {
      setup(three);
      expect(screen.getByText(/Space to mark done/)).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});
