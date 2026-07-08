import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MoveActionMenu } from './MoveActionMenu';
import type { QuickMoveTarget } from '@/domain/lenses';

const TARGETS: QuickMoveTarget[] = [
  { id: 'p1', label: 'Home › Kitchen', kind: 'sibling' },
  { id: 'free', label: 'Free actions', kind: 'free' },
];

describe('MoveActionMenu', () => {
  it('renders nothing on phone without quick destinations (no browse fallback there)', () => {
    render(
      <MoveActionMenu title="Buy milk" quickTargets={[]} browseTargets={() => []} onMove={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Move Buy milk to another project' })).not.toBeInTheDocument();
  });

  it('still offers the icon on desktop with no quick targets — browse stays reachable (#694)', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) =>
      ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
    try {
      render(
        <MoveActionMenu title="Buy milk" quickTargets={[]} browseTargets={() => []} onMove={vi.fn()} />,
      );
      fireEvent.keyDown(screen.getByRole('button', { name: 'Move Buy milk to another project' }), { key: 'Enter' });
      expect(screen.getByRole('menuitem', { name: 'Browse all projects…' })).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it('moves to a picked destination (phone dropdown branch)', () => {
    const onMove = vi.fn();
    render(
      <MoveActionMenu title="Buy milk" quickTargets={TARGETS} browseTargets={() => []} onMove={onMove} />,
    );
    // Radix opens the menu on Enter/Space/ArrowDown (reliable in jsdom).
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move Buy milk to another project' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Home › Kitchen' }));
    expect(onMove).toHaveBeenCalledWith('p1');
  });
});
