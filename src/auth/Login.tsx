import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/LogoMark';
import { supabase } from '../lib/supabase';

// TODO(dev-only): prefill the local Supabase test credentials to speed manual
// testing. Gated on import.meta.env.DEV so it never ships in a production build;
// delete this block before going productish.
const DEV_EMAIL = import.meta.env.DEV ? 'test@namdesktop.local' : '';
const DEV_PASSWORD = import.meta.env.DEV ? 'namdesktop-local' : '';

/** Email/password sign-in. Single-user; the session is persisted by supabase-js. */
export function Login() {
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setBusy(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12 text-card-foreground" />
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-card-foreground">NamWeb</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace.</p>
        </div>

        <label className="block text-sm font-medium text-foreground">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-ring"
          />
        </label>

        <label className="block text-sm font-medium text-foreground">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-ring"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
