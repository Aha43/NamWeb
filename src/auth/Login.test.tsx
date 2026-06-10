import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Supabase client so the form's sign-in call is observable and no real
// client is constructed (which would require env vars).
const { signInWithPassword } = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signInWithPassword } } }));

import { Login } from './Login';

describe('Login', () => {
  beforeEach(() => signInWithPassword.mockReset());

  function fillAndSubmit(email: string, password: string) {
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  }

  it('submits the entered credentials', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<Login />);
    fillAndSubmit('test@namdesktop.local', 'namdesktop-local');
    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'test@namdesktop.local',
        password: 'namdesktop-local',
      }),
    );
  });

  it('surfaces the error message on failed sign-in', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<Login />);
    fillAndSubmit('test@namdesktop.local', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
  });
});
