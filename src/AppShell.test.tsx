import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders the title, sign-out, and the three nav tabs', () => {
    render(<AppShell onSignOut={() => {}} />);
    expect(screen.getByRole('heading', { name: 'NamWeb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backlog' })).toBeInTheDocument();
  });

  it('switches the active tab on nav click', () => {
    render(<AppShell onSignOut={() => {}} />);
    const inboxTab = screen.getByRole('button', { name: 'Inbox' });
    expect(inboxTab).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: 'Backlog' }));
    expect(screen.getByRole('button', { name: 'Backlog' })).toHaveAttribute('aria-current', 'page');
    expect(inboxTab).not.toHaveAttribute('aria-current');
  });

  it('calls onSignOut when Sign out is clicked', () => {
    const onSignOut = vi.fn();
    render(<AppShell onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
