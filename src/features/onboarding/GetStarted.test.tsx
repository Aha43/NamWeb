import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GetStarted } from './GetStarted';

describe('GetStarted', () => {
  it('names the loop and wires capture / learn-nam / dismiss', () => {
    const onCapture = vi.fn();
    const onAddLearnNam = vi.fn();
    const onDismiss = vi.fn();
    render(<GetStarted onCapture={onCapture} onAddLearnNam={onAddLearnNam} onDismiss={onDismiss} />);

    expect(screen.getByText('Welcome to NAM 👋')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Capture your first thought/ }));
    expect(onCapture).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Add the Learn NAM project/ }));
    expect(onAddLearnNam).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss get started' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
