import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getUser, signOut, updateUser, rpc } = vi.hoisted(() => ({
  getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'me@nam.local' } } }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  updateUser: vi.fn().mockResolvedValue({ error: null }),
  rpc: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getUser, signOut, updateUser }, rpc } }));

const { buildUserExport, downloadJson } = vi.hoisted(() => ({
  buildUserExport: vi.fn().mockResolvedValue({ exportedAt: '2026-06-16T00:00:00Z', user: {}, workspaces: [] }),
  downloadJson: vi.fn(),
}));
vi.mock('@/lib/exportData', () => ({ buildUserExport, downloadJson }));

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

  it('exports the user data as a JSON download', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /export my data/i }));
    await waitFor(() => expect(buildUserExport).toHaveBeenCalled());
    await waitFor(() => expect(downloadJson).toHaveBeenCalled());
  });

  it('changes the password when valid', async () => {
    renderAt();
    await screen.findByText('me@nam.local');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'longenough' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'longenough' }));
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });

  it('blocks a password change on mismatch', async () => {
    renderAt();
    await screen.findByText('me@nam.local');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'longenough' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different1' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/don't match/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('deletes the account only after typing DELETE', async () => {
    renderAt();
    await screen.findByText('me@nam.local');
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));

    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: /^delete account$/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/type delete to confirm/i), {
      target: { value: 'DELETE' },
    });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('delete_my_account'));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it('signs out from the Account tab', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it('copies an invite link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderAt();
    await screen.findByText('me@nam.local');
    fireEvent.click(screen.getByRole('button', { name: /copy invite link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('invite')));
    expect(await screen.findByText(/link copied/i)).toBeInTheDocument();
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
