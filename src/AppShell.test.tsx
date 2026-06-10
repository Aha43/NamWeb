import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import type { UseWorkspace } from './store/useWorkspace';

function workspace(overrides: Partial<UseWorkspace> = {}): UseWorkspace {
  return {
    document: null,
    loading: false,
    error: null,
    noRemote: false,
    notice: null,
    clearNotice: vi.fn(),
    retry: vi.fn(),
    dispatch: vi.fn(),
    ...overrides,
  };
}

describe('AppShell', () => {
  it('renders the title, sign-out, and the three nav tabs', () => {
    render(<AppShell workspace={workspace()} onSignOut={() => {}} />);
    expect(screen.getByRole('heading', { name: 'NamWeb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backlog' })).toBeInTheDocument();
  });

  it('switches the active tab on nav click', () => {
    render(<AppShell workspace={workspace()} onSignOut={() => {}} />);
    const inboxTab = screen.getByRole('button', { name: 'Inbox' });
    expect(inboxTab).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: 'Backlog' }));
    expect(screen.getByRole('button', { name: 'Backlog' })).toHaveAttribute('aria-current', 'page');
    expect(inboxTab).not.toHaveAttribute('aria-current');
  });

  it('calls onSignOut when Sign out is clicked', () => {
    const onSignOut = vi.fn();
    render(<AppShell workspace={workspace()} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('shows a loading state while the workspace loads', () => {
    render(<AppShell workspace={workspace({ loading: true })} onSignOut={() => {}} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows a load error with a Retry that re-runs the load', () => {
    const retry = vi.fn();
    render(<AppShell workspace={workspace({ error: 'Network error', retry })} onSignOut={() => {}} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows the no-remote hint when there is no workspace yet', () => {
    render(<AppShell workspace={workspace({ noRemote: true })} onSignOut={() => {}} />);
    expect(screen.getByText(/sync from the desktop app first/i)).toBeInTheDocument();
  });

  it('shows a dismissible sync notice', () => {
    const clearNotice = vi.fn();
    render(<AppShell workspace={workspace({ notice: 'Reloaded — synced from another device', clearNotice })} onSignOut={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Reloaded');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(clearNotice).toHaveBeenCalledOnce();
  });
});
