import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { ShellContent } from './ShellContent';

function ws(overrides: Partial<UseWorkspace> = {}): UseWorkspace {
  return {
    document: null, loading: false, error: null, noRemote: false, creating: false,
    createWorkspace: vi.fn(), notice: null,
    clearNotice: vi.fn(), retry: vi.fn(), retrySync: vi.fn(), dispatch: vi.fn(), ...overrides,
 flush: async () => true, getCommittedDocument: () => null,
  };
}

function renderContent(value: UseWorkspace) {
  render(
    <WorkspaceContext.Provider value={value}>
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route element={<ShellContent />}>
            <Route path="/" element={<div>workspace surface</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </WorkspaceContext.Provider>,
  );
}

describe('ShellContent — no workspace yet', () => {
  it('offers to bootstrap a fresh workspace and reassures desktop-first users (Check again re-pulls)', () => {
    const retry = vi.fn();
    renderContent(ws({ noRemote: true, retry }));
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeInTheDocument();
    // Desktop-first users aren't stranded: a reassurance + a "Check again" that re-pulls.
    expect(screen.getByText(/already use nam on the desktop/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('invokes createWorkspace when the button is clicked', () => {
    const createWorkspace = vi.fn();
    renderContent(ws({ noRemote: true, createWorkspace }));
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    expect(createWorkspace).toHaveBeenCalledOnce();
  });

  it('disables the button and shows progress while creating', () => {
    renderContent(ws({ noRemote: true, creating: true }));
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
  });

  it('renders the routed surface once a workspace exists', () => {
    renderContent(ws({ noRemote: false }));
    expect(screen.getByText('workspace surface')).toBeInTheDocument();
  });
});
