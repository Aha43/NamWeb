import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CopyButton } from './copy-button';

describe('CopyButton', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('copies the value and flips to a "Copied" state', async () => {
    render(<CopyButton value="hello world" label="title" />);
    const btn = screen.getByRole('button', { name: 'Copy title' });
    fireEvent.click(btn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello world');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied title' })).toBeInTheDocument());
  });

  it('is disabled when there is nothing to copy', () => {
    render(<CopyButton value="   " label="title" />);
    expect(screen.getByRole('button', { name: 'Copy title' })).toBeDisabled();
  });

  it('still copies when wrapped with a tooltip (#501)', async () => {
    render(<CopyButton value="hello" label="name" tooltip />);
    const btn = screen.getByRole('button', { name: 'Copy name' });
    fireEvent.click(btn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied name' })).toBeInTheDocument());
  });
});
