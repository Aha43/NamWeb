import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getUser, signOut } = vi.hoisted(() => ({
  getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'me@nam.local' } } }),
  signOut: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getUser, signOut } } }));

import { AccountPage } from './AccountPage';
import { SettingsProvider } from '@/components/settings/SettingsProvider';
import { DATE_FORMAT_STORAGE_KEY } from '@/components/settings/settings-context';

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

function renderAt(path = '/account') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SettingsProvider>
        <AccountPage />
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe('AccountPage', () => {
  it('defaults to the Account tab and shows the signed-in email', async () => {
    renderAt();
    expect(await screen.findByText('me@nam.local')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('signs out from the Account tab', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it('shows the date-format preference on the Preferences tab (deep-linked)', () => {
    renderAt('/account?tab=preferences');
    const select = screen.getByLabelText('Date format') as HTMLSelectElement;
    expect(select.value).toBe('medium');
    expect(screen.getByRole('option', { name: /Medium — Jun 14, 2026/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /ISO — 2026-06-14/ })).toBeInTheDocument();
  });

  it('changing the format persists it', () => {
    renderAt('/account?tab=preferences');
    const select = screen.getByLabelText('Date format') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'iso' } });
    expect(select.value).toBe('iso');
    expect(localStorage.getItem(DATE_FORMAT_STORAGE_KEY)).toBe('iso');
  });

  it('switches tabs via the tablist', async () => {
    renderAt();
    await screen.findByText('me@nam.local');
    fireEvent.click(screen.getByRole('tab', { name: /preferences/i }));
    await waitFor(() => expect(screen.getByLabelText('Date format')).toBeInTheDocument());
  });
});
