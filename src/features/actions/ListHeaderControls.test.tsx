import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ListHeaderControls } from './ListHeaderControls';

// jsdom defaults to phone (matchMedia matches: false); the desktop arrangement is covered by
// the desktop-overriding suites and the mocked-desktop journeys.
describe('ListHeaderControls (#777)', () => {
  it('phone: filters stack behind one chip; Focus stays out beside it', () => {
    render(
      <ListHeaderControls
        statusSlot={<div data-testid="boxes" />}
        rowsToggle={<button>Cozy</button>}
        sortSlot={<button>Unsorted</button>}
        focusSlot={<button>Focus</button>}
      />,
    );
    const chip = screen.getByRole('button', { name: 'Filter' });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument(); // primary, not filed away
    expect(screen.getByTestId('boxes').parentElement).toHaveClass('hidden');

    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('boxes').parentElement).not.toHaveClass('hidden');
    expect(screen.getByRole('button', { name: 'Cozy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unsorted' })).toBeInTheDocument();
  });

  it('phone: no chip at all when there is nothing to file away', () => {
    render(<ListHeaderControls focusSlot={<button>Focus</button>} />);
    expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument();
  });
});
