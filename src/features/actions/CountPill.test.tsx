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

  it('the − steps down with the same guard; edge buttons stay rendered but disabled (#802/F5)', () => {
    const dispatch = vi.fn();
    render(
      <WorkspaceContext.Provider value={{ document: null, dispatch } as unknown as UseWorkspace}>
        <CountPill nodeId="a1" index={1} current={3} target={3} label="stock" />
      </WorkspaceContext.Provider>,
    );
    // Full: the + doesn't vanish under a mid-burst finger — it stays, disabled.
    expect(screen.getByRole('button', { name: 'Count one on stock' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Count one off stock' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'incrementCountResource', delta: -1, expectedValue: '3/3' }),
    );
  });

  it('at zero the − is disabled, not gone (#802/F5)', () => {
    render(
      <WorkspaceContext.Provider value={{ document: null, dispatch: vi.fn() } as unknown as UseWorkspace}>
        <CountPill nodeId="a1" index={1} current={0} target={3} label="stock" />
      </WorkspaceContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Count one off stock' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Count one on stock' })).toBeEnabled();
  });

  it('dispatches the STORED value as the guard, not a reconstruction (#802/F3)', () => {
    const dispatch = vi.fn();
    render(
      <WorkspaceContext.Provider value={{ document: null, dispatch } as unknown as UseWorkspace}>
        <CountPill nodeId="a1" index={1} current={3} target={10} rawValue="03/10" label="boxes" />
      </WorkspaceContext.Provider>,
    );
    // A desktop-era/hand-edited "03/10" parses fine but formatCount would emit "3/10" —
    // a reconstructed guard would no-op forever against the stored string.
    fireEvent.click(screen.getByRole('button', { name: 'Count one on boxes' }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ expectedValue: '03/10' }));
  });

  it('an unlimited pill (#800) keeps its + past the goal — green, still counting', () => {
    const dispatch = vi.fn();
    render(
      <WorkspaceContext.Provider value={{ document: null, dispatch } as unknown as UseWorkspace}>
        <CountPill nodeId="a1" index={1} current={12} target={12} unlimited label="jars" />
      </WorkspaceContext.Provider>,
    );
    expect(screen.getByText(/12\/12/)).toBeInTheDocument(); // display drops the machine marker
    fireEvent.click(screen.getByRole('button', { name: 'Count one on jars' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'incrementCountResource', delta: 1, expectedValue: '12/12+' }),
    );
  });

  it('renders read-only without a workspace (guest-page ready)', () => {
    render(<CountPill nodeId="a1" index={0} current={1} target={3} label={null} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });

  it('onStep mode (#810): interactive without a workspace, stepping through the host', () => {
    const onStep = vi.fn();
    render(<CountPill nodeId="aa11" index={1} current={2} target={3} onStep={onStep} label="jars" />);
    fireEvent.click(screen.getByRole('button', { name: 'Count one on jars' }));
    expect(onStep).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Count one off jars' }));
    expect(onStep).toHaveBeenCalledWith(-1);
  });
});
