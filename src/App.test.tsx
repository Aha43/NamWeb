import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App shell', () => {
  it('renders the app title and the three nav tabs', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'NamWeb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backlog' })).toBeInTheDocument();
  });

  it('switches the active tab on nav click', () => {
    render(<App />);
    const inboxTab = screen.getByRole('button', { name: 'Inbox' });
    expect(inboxTab).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: 'Backlog' }));
    expect(screen.getByRole('button', { name: 'Backlog' })).toHaveAttribute('aria-current', 'page');
    expect(inboxTab).not.toHaveAttribute('aria-current');
  });
});
