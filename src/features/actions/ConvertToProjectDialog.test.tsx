import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConvertToProjectDialog } from './ConvertToProjectDialog';

describe('ConvertToProjectDialog (#999)', () => {
  it('collects names via Enter, removes one, includes a trailing draft, and confirms', () => {
    const onConfirm = vi.fn();
    render(<ConvertToProjectDialog open onOpenChange={vi.fn()} title="Plan trip" onConfirm={onConfirm} />);
    const input = screen.getByLabelText('Add an action');
    fireEvent.change(input, { target: { value: 'Book flights' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'Pack bags' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Remove the first, leave a trailing un-added draft — it's included on create.
    fireEvent.click(screen.getByRole('button', { name: 'Remove Book flights' }));
    fireEvent.change(input, { target: { value: 'Book hotel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(onConfirm).toHaveBeenCalledWith(['Pack bags', 'Book hotel']);
  });

  it('creates an empty project when nothing is entered', () => {
    const onConfirm = vi.fn();
    render(<ConvertToProjectDialog open onOpenChange={vi.fn()} title="X" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(onConfirm).toHaveBeenCalledWith([]);
  });
});
