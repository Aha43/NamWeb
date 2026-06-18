import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TruncatedTitle } from './truncated-title';

/** Force (or clear) an overflow condition by stubbing the layout-measurement getters jsdom fakes as 0. */
function stubOverflow(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth);
}

afterEach(() => vi.restoreAllMocks());

describe('TruncatedTitle', () => {
  it('always shows the text', () => {
    render(<TruncatedTitle text="Buy tiles" />);
    expect(screen.getByText('Buy tiles')).toBeInTheDocument();
  });

  it('arms a tooltip only when the text is actually clipped', () => {
    // Not clipped: scrollWidth <= clientWidth → no tooltip trigger wiring.
    stubOverflow(40, 100);
    const { unmount } = render(<TruncatedTitle text="short" />);
    expect(screen.getByText('short')).not.toHaveAttribute('data-state');
    unmount();

    // Clipped: scrollWidth > clientWidth → wrapped as a tooltip trigger.
    stubOverflow(200, 100);
    render(<TruncatedTitle text="a very long title that gets cut off" />);
    expect(screen.getByText('a very long title that gets cut off')).toHaveAttribute('data-state');
  });
});
