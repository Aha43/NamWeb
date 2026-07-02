import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusMenu } from './StatusMenu';

describe('StatusMenu', () => {
  it('shows the current status badge', () => {
    render(<StatusMenu status="NEXT" title="Buy milk" onSetStatus={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /status of Buy milk: NEXT/i });
    expect(trigger).toHaveTextContent('N');
  });

  it('names the status in the aria/tooltip with the translated label, not the raw enum (#565)', () => {
    render(<StatusMenu status="DONE" title="Buy milk" onSetStatus={vi.fn()} />);
    // Case-sensitive: "Done" (the label) matches; "DONE" (the enum) would not.
    expect(screen.getByRole('button', { name: /Status of Buy milk: Done\. Change status\./ })).toBeInTheDocument();
  });

  it('sets the chosen status from the menu', () => {
    const onSetStatus = vi.fn();
    render(<StatusMenu status="NEXT" title="Buy milk" onSetStatus={onSetStatus} />);
    // Radix opens the menu on Enter/Space/ArrowDown (reliable in jsdom).
    fireEvent.keyDown(screen.getByRole('button', { name: /status of Buy milk/i }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Done' }));
    expect(onSetStatus).toHaveBeenCalledWith('DONE');
  });
});
