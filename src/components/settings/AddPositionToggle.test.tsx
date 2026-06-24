import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AddPositionToggle } from './AddPositionToggle';
import { SettingsProvider } from './SettingsProvider';
import { ADD_TO_BOTTOM_STORAGE_KEY } from './settings-context';

afterEach(() => localStorage.clear());

describe('AddPositionToggle', () => {
  it('starts at the default (top) and flips the here-and-now position on click', () => {
    render(
      <SettingsProvider>
        <AddPositionToggle />
      </SettingsProvider>,
    );
    const button = screen.getByRole('button', { name: /new items add to the top/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    const flipped = screen.getByRole('button', { name: /new items add to the bottom/i });
    expect(flipped).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts from the persisted default when one is set', () => {
    localStorage.setItem(ADD_TO_BOTTOM_STORAGE_KEY, '1');
    render(
      <SettingsProvider>
        <AddPositionToggle />
      </SettingsProvider>,
    );
    expect(screen.getByRole('button', { name: /new items add to the bottom/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('does NOT persist the here-and-now flip (default stays untouched)', () => {
    render(
      <SettingsProvider>
        <AddPositionToggle />
      </SettingsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /new items add to the top/i }));
    // The session flip must not write the persisted default.
    expect(localStorage.getItem(ADD_TO_BOTTOM_STORAGE_KEY)).toBe('0');
  });
});
