import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './ToastProvider';
import { useToast } from './toast-context';

function Harness({ onAction }: { onAction?: () => void }) {
  const { toast } = useToast();
  return (
    <>
      <button onClick={() => toast({ message: 'Marked done', actionLabel: 'Undo', onAction })}>fire</button>
      <button onClick={() => toast({ message: 'Plain note' })}>plain</button>
      <input aria-label="field" />
    </>
  );
}

describe('ToastProvider — the Undo shortcut (#744)', () => {
  it('⌘/Ctrl+Z fires the newest actionable toast and dismisses it', () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Harness onAction={onAction} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByText('Marked done')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Marked done')).not.toBeInTheDocument(); // dismissed, like a click
  });

  it('a toast without an action leaves the key alone', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('plain'));
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    expect(screen.getByText('Plain note')).toBeInTheDocument(); // still up — nothing to undo
  });

  it('typing in a field keeps its own undo — the toast does not steal ⌘Z', () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Harness onAction={onAction} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire'));
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'z', ctrlKey: true });
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText('Marked done')).toBeInTheDocument();
  });

  it('the action button teaches the shortcut with a key hint', () => {
    render(
      <ToastProvider>
        <Harness onAction={vi.fn()} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByRole('button', { name: /Undo/ })).toHaveTextContent(/⌘Z|Ctrl\+Z/);
  });
});
