import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Supabase auth client so the calls are observable and no real client is built.
const { signInWithPassword, signUp, resetPasswordForEmail, updateUser } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword, signUp, resetPasswordForEmail, updateUser } },
}));

import { AuthScreen } from './AuthScreen';
import { getWorkspaceName, isDevWorkspaceSelected } from '../lib/workspace';

describe('AuthScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('shows the brand logo', () => {
    render(<AuthScreen />);
    expect(screen.getByRole('img', { name: /next action master/i })).toBeInTheDocument();
  });

  it('opens in sign-up mode from an invite link', () => {
    window.history.replaceState({}, '', '/?invite=1');
    render(<AuthScreen />);
    expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument();
  });

  it('signs in with the entered credentials', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthScreen />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'secret1' }),
    );
  });

  it('surfaces a failed sign-in error', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
  });

  it('toggling the dev-workspace checkbox selects the dev row', () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByLabelText(/use dev workspace/i));
    expect(getWorkspaceName()).toBe('dev');
    fireEvent.click(screen.getByLabelText(/use dev workspace/i));
    expect(isDevWorkspaceSelected()).toBe(false);
  });

  it('cancels the create-account form back to sign in (top Cancel)', () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole('button', { name: /create an account/i }));
    expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument();
    // The prominent top "← Back to sign in" returns to the sign-in form.
    fireEvent.click(screen.getByRole('button', { name: '← Back to sign in' }));
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('signs up and shows a neutral "check your email" message', async () => {
    signUp.mockResolvedValue({ error: null });
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole('button', { name: /create an account/i }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@b.c' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret12' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secret12' } });
    fireEvent.click(screen.getByRole('checkbox')); // accept terms (13+)
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@b.c', password: 'secret12' }),
      ),
    );
    expect(await screen.findByText(/check your email to confirm/i)).toBeInTheDocument();
  });

  it('blocks sign-up until the terms are accepted', async () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole('button', { name: /create an account/i }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret12' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secret12' } });
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/accept the terms/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('blocks sign-up when the passwords do not match', async () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole('button', { name: /create an account/i }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret12' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secret99' } });
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/don't match/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('blocks sign-up for a too-short password', async () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole('button', { name: /create an account/i }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('requests a password reset and stays neutral', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole('button', { name: /forgot your password/i }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.c' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledWith('a@b.c', expect.any(Object)));
    expect(await screen.findByText(/reset link is on its way/i)).toBeInTheDocument();
  });

  it('sets a new password in reset mode and signals completion', async () => {
    updateUser.mockResolvedValue({ error: null });
    const onResetDone = vi.fn();
    render(<AuthScreen initialMode="reset" onResetDone={onResetDone} />);
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'newpass1' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'newpass1' } });
    fireEvent.click(screen.getByRole('button', { name: /save password/i }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'newpass1' }));
    expect(onResetDone).toHaveBeenCalled();
  });
});
