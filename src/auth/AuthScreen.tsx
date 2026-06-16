import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/LogoMark';
import { supabase } from '../lib/supabase';
import { APP_NAME } from '../lib/app';
import { DEV_WORKSPACE, isDevWorkspaceSelected, setWorkspaceName } from '../lib/workspace';
import { MIN_PASSWORD, validateNewPassword } from '../lib/password';
import { Turnstile } from './Turnstile';

// Bot protection is active only when a Turnstile site key is configured (production).
const turnstileEnabled = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

// TODO(dev-only): prefill the local test credentials to speed manual testing.
const DEV_EMAIL = import.meta.env.DEV ? 'test@namdesktop.local' : '';
const DEV_PASSWORD = import.meta.env.DEV ? 'namdesktop-local' : '';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

/** Modes where the user is choosing a new password (confirm + sanity-check it). */
const SETS_PASSWORD = (m: Mode) => m === 'signup' || m === 'reset';

const COPY: Record<Mode, { title: string; sub: string; submit: string }> = {
  signin: { title: APP_NAME, sub: 'Sign in to your workspace.', submit: 'Sign in' },
  signup: { title: 'Create your account', sub: `Start using ${APP_NAME} on the web.`, submit: 'Create account' },
  forgot: { title: 'Reset your password', sub: "We'll email you a reset link.", submit: 'Send reset link' },
  reset: { title: 'Set a new password', sub: 'Choose a new password for your account.', submit: 'Save password' },
};

export interface AuthScreenProps {
  /** Start in a specific mode — `reset` when arriving via a password-recovery link. */
  initialMode?: Mode;
  /** Called after a successful password reset, so the app can clear recovery and proceed. */
  onResetDone?: () => void;
}

/** True when the URL carries an `?invite` param (an invite link → open on sign-up). */
function hasInviteParam(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('invite');
  } catch {
    return false;
  }
}

/** Email/password auth: sign in, sign up (+ email verification), forgot/reset password. */
export function AuthScreen({ initialMode, onResetDone }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>(initialMode ?? (hasInviteParam() ? 'signup' : 'signin'));
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [devWorkspace, setDevWorkspace] = useState(isDevWorkspaceSelected());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const copy = COPY[mode];

  function go(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setConfirm('');
    setAccepted(false);
    setCaptchaToken(null);
  }

  function toggleDevWorkspace(checked: boolean) {
    setDevWorkspace(checked);
    setWorkspaceName(checked ? DEV_WORKSPACE : null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    // Sanity-check a freshly chosen password before hitting the server.
    if (SETS_PASSWORD(mode)) {
      const pwError = validateNewPassword(password, confirm);
      if (pwError) {
        setError(pwError);
        return;
      }
    }

    // Sign-up consent gate (GDPR): age + terms acceptance, and bot check if enabled.
    if (mode === 'signup') {
      if (!accepted) {
        setError('Please confirm you are 13+ and accept the Terms and Privacy Policy.');
        return;
      }
      if (turnstileEnabled && !captchaToken) {
        setError('Please complete the verification.');
        return;
      }
    }

    setBusy(true);
    if (mode === 'signin') {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e) setError(e.message);
    } else if (mode === 'signup') {
      const { error: e } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, captchaToken: captchaToken ?? undefined },
      });
      // Neutral on success (don't reveal whether the email already exists).
      if (e) setError(e.message);
      else setInfo('Check your email to confirm your account. If you already have one, sign in instead.');
    } else if (mode === 'forgot') {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      // Always neutral — no account enumeration.
      if (e) setError(e.message);
      else setInfo('If that email has an account, a password-reset link is on its way.');
    } else {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) setError(e.message);
      else onResetDone?.();
    }
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
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-card-foreground">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.sub}</p>
        </div>

        {mode !== 'reset' && (
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
        )}

        {mode !== 'forgot' && (
          <label className="block text-sm font-medium text-foreground">
            Password
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'signin' ? undefined : MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-ring"
            />
          </label>
        )}

        {SETS_PASSWORD(mode) && (
          <p className="-mt-2 text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
        )}

        {SETS_PASSWORD(mode) && (
          <label className="block text-sm font-medium text-foreground">
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-ring"
            />
          </label>
        )}

        {mode === 'signup' && (
          <>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I'm 13 or older and agree to the{' '}
                <a href="/terms.html" target="_blank" rel="noreferrer" className="text-foreground underline">
                  Terms
                </a>{' '}
                and{' '}
                <a href="/privacy.html" target="_blank" rel="noreferrer" className="text-foreground underline">
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            {turnstileEnabled && <Turnstile onToken={setCaptchaToken} />}
          </>
        )}

        {import.meta.env.DEV && mode === 'signin' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={devWorkspace}
              onChange={(e) => toggleDevWorkspace(e.target.checked)}
            />
            Use dev workspace
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {info && <p className="text-sm text-muted-foreground">{info}</p>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Working…' : copy.submit}
        </Button>

        {mode !== 'reset' && (
          <div className="space-y-1 text-center text-sm text-muted-foreground">
            {mode === 'signin' && (
              <>
                <button type="button" onClick={() => go('forgot')} className="hover:text-foreground hover:underline">
                  Forgot your password?
                </button>
                <p>
                  New here?{' '}
                  <button type="button" onClick={() => go('signup')} className="font-medium text-foreground hover:underline">
                    Create an account
                  </button>
                </p>
              </>
            )}
            {(mode === 'signup' || mode === 'forgot') && (
              <p>
                <button type="button" onClick={() => go('signin')} className="font-medium text-foreground hover:underline">
                  Back to sign in
                </button>
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
