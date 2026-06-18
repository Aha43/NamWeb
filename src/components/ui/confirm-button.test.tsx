import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmButton } from './confirm-button';

describe('ConfirmButton', () => {
  it('asks before acting: opens a popover, confirms on Confirm', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmButton aria-label="Delete Foo" message='Delete "Foo"?' onConfirm={onConfirm}>
        trash
      </ConfirmButton>,
    );
    // Not fired until confirmed.
    fireEvent.click(screen.getByRole('button', { name: 'Delete Foo' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Delete "Foo"?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels without acting', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmButton aria-label="Delete Foo" message='Delete "Foo"?' onConfirm={onConfirm}>
        trash
      </ConfirmButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Foo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
