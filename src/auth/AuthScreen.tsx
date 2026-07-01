import { useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/LogoMark';
import { VersionBadge } from '@/components/VersionBadge';
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

export interface AuthScreenProps {
  /** Start in a specific mode — `reset` when arriving via a password-recovery link. */
  initialMode?: Mode;
  /** Called after a successful password reset, so the app can clear recovery and proceed. */
  onResetDone?: () => void;
  /** Enter the no-account demo. When provided, a "Try the demo" link is shown. */
  onTryDemo?: () => void;
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
export function AuthScreen({ initialMode, onResetDone, onTryDemo }: AuthScreenProps) {
  const { t } = useTranslation();
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

  const COPY: Record<Mode, { title: string; sub: string; submit: string }> = {
    signin: { title: APP_NAME, sub: t('auth.signinSub'), submit: t('auth.signinSubmit') },
    signup: { title: t('auth.signupTitle'), sub: t('auth.signupSub', { app: APP_NAME }), submit: t('auth.signupSubmit') },
    forgot: { title: t('auth.forgotTitle'), sub: t('auth.forgotSub'), submit: t('auth.forgotSubmit') },
    reset: { title: t('auth.resetTitle'), sub: t('auth.resetSub'), submit: t('auth.resetSubmit') },
  };
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
        setError(t('auth.consentError'));
        return;
      }
      if (turnstileEnabled && !captchaToken) {
        setError(t('auth.captchaError'));
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
      else setInfo(t('auth.signupInfo'));
    } else if (mode === 'forgot') {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      // Always neutral — no account enumeration.
      if (e) setError(e.message);
      else setInfo(t('auth.forgotInfo'));
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
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs"
      >
        {(mode === 'signup' || mode === 'forgot') && (
          <button
            type="button"
            onClick={() => go('signin')}
            className="-mb-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← {t('auth.backToSignin')}
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12 text-card-foreground" />
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-card-foreground">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.sub}</p>
        </div>

        {mode !== 'reset' && (
          <label className="block text-sm font-medium text-foreground">
            {t('account.email')}
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
            />
          </label>
        )}

        {mode !== 'forgot' && (
          <label className="block text-sm font-medium text-foreground">
            {t('auth.password')}
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'signin' ? undefined : MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
            />
          </label>
        )}

        {SETS_PASSWORD(mode) && (
          <p className="-mt-2 text-xs text-muted-foreground">{t('auth.minChars', { count: MIN_PASSWORD })}</p>
        )}

        {SETS_PASSWORD(mode) && (
          <label className="block text-sm font-medium text-foreground">
            {t('auth.confirmPassword')}
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
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
                <Trans
                  i18nKey="auth.consent"
                  components={{
                    terms: <a href="/terms.html" target="_blank" rel="noreferrer" className="text-foreground underline" />,
                    privacy: <a href="/privacy.html" target="_blank" rel="noreferrer" className="text-foreground underline" />,
                  }}
                />
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
            {t('auth.useDevWorkspace')}
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {info && <p className="text-sm text-muted-foreground">{info}</p>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t('auth.working') : copy.submit}
        </Button>

        {mode !== 'reset' && (
          <div className="space-y-1 text-center text-sm text-muted-foreground">
            {mode === 'signin' && (
              <>
                <button type="button" onClick={() => go('forgot')} className="hover:text-foreground hover:underline">
                  {t('auth.forgotLink')}
                </button>
                <p>
                  {t('auth.newHere')}{' '}
                  <button type="button" onClick={() => go('signup')} className="font-medium text-foreground hover:underline">
                    {t('auth.createAccount')}
                  </button>
                </p>
              </>
            )}
            {(mode === 'signup' || mode === 'forgot') && (
              <p>
                <button type="button" onClick={() => go('signin')} className="font-medium text-foreground hover:underline">
                  {t('auth.backToSignin')}
                </button>
              </p>
            )}
          </div>
        )}
        {onTryDemo && mode !== 'reset' && (
          <div className="border-t border-border pt-3 text-center">
            <button
              type="button"
              onClick={onTryDemo}
              className="text-sm font-medium text-foreground hover:underline"
            >
              {t('auth.tryDemo')}
            </button>
          </div>
        )}

        <VersionBadge className="pt-1 text-center" />
      </form>
    </div>
  );
}
