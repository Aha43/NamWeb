import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { CountPill } from './CountPill';

describe('CountPill (#798) — the first interactive resource', () => {
  it('+1 dispatches immediately with the stale guard; a full pill is a quiet badge', () => {
    const dispatch = vi.fn();
    render(
      <WorkspaceContext.Provider value={{ document: null, dispatch } as unknown as UseWorkspace}>
        <CountPill nodeId="a1" index={1} current={2} target={3} label="boxes" />
      </WorkspaceContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Count one on boxes' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'incrementCountResource', id: 'a1', index: 1, expectedValue: '2/3' }),
    );
  });

  it('the − steps down with the same guard; edges lose their buttons (#798 stock)', () => {
    const dispatch = vi.fn();
    render(
      <WorkspaceContext.Provider value={{ document: null, dispatch } as unknown as UseWorkspace}>
        <CountPill nodeId="a1" index={1} current={3} target={3} label="stock" />
      </WorkspaceContext.Provider>,
    );
    expect(screen.queryByRole('button', { name: 'Count one on stock' })).not.toBeInTheDocument(); // full: no +
    fireEvent.click(screen.getByRole('button', { name: 'Count one off stock' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'incrementCountResource', delta: -1, expectedValue: '3/3' }),
    );
  });

  it('renders read-only without a workspace (guest-page ready)', () => {
    render(<CountPill nodeId="a1" index={0} current={1} target={3} label={null} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });
});
