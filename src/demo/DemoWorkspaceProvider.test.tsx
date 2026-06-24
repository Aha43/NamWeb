import { useContext } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceContext } from '@/store/workspace-context';
import { DemoWorkspaceProvider } from './DemoWorkspaceProvider';
import { DemoContext } from './demo-context';

function Probe() {
  const { document, dispatch } = useWorkspaceContext();
  const demo = useContext(DemoContext)!;
  const inbox = document ? document.nodes[document.inboxNodeId].childIds.length : -1;
  const seeded = document ? Object.values(document.nodes).some((n) => n.title.startsWith('Vacation')) : false;
  return (
    <div>
      <span data-testid="inbox">{inbox}</span>
      <span data-testid="seeded">{String(seeded)}</span>
      <button onClick={() => dispatch({ type: 'addInboxItem', id: 'new1', title: 'demo note', now: '2026-01-01T00:00:00' })}>
        add
      </button>
      <button onClick={demo.reset}>reset</button>
    </div>
  );
}

describe('DemoWorkspaceProvider', () => {
  beforeEach(() => localStorage.clear());

  it('seeds the demo workspace, applies intents locally, and resets', () => {
    render(
      <DemoWorkspaceProvider onSignUp={vi.fn()}>
        <Probe />
      </DemoWorkspaceProvider>,
    );
    expect(screen.getByTestId('seeded').textContent).toBe('true'); // buildDemo content loaded
    expect(screen.getByTestId('inbox').textContent).toBe('0'); // demo seed has an empty inbox

    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('inbox').textContent).toBe('1'); // dispatch applied via applyIntent

    fireEvent.click(screen.getByText('reset'));
    expect(screen.getByTestId('inbox').textContent).toBe('0'); // back to the seed
  });

  it('persists edits to localStorage', () => {
    render(
      <DemoWorkspaceProvider onSignUp={vi.fn()}>
        <Probe />
      </DemoWorkspaceProvider>,
    );
    fireEvent.click(screen.getByText('add'));
    expect(localStorage.getItem('namweb.demo.document')).toContain('demo note');
  });
});
