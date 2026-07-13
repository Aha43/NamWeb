import { useEffect, useState } from 'react';
import { AuthedApp } from './AuthedApp';
import { AuthScreen } from './auth/AuthScreen';
import { useSession } from './auth/useSession';
import { DemoApp } from './demo/DemoApp';
import { GuestSharePage } from './features/sharing/GuestSharePage';

/** The guest page (#761) sits fully outside the auth gate: no session, no providers, no app.
 *  The token rides the path (/p/<token>); the page is the share's whole world. */
function guestToken(): string | null {
  const m = window.location.pathname.match(/^\/p\/([A-Za-z0-9-]+)\/?$/);
  return m ? m[1] : null;
}

/** Auth gate: shows the auth screen until there is a session, then the app — or the no-account demo. */
export default function App() {
  // A guest with a share link never sees a sign-in wall, a loading app, or a NAM concept.
  // All hooks run unconditionally (rules of hooks); the guest return comes after them.
  const [token] = useState(guestToken);
  const { session, loading, recovery, clearRecovery } = useSession();
  // Demo mode: entered via "Try the demo" or a direct /demo link. Replace /demo with / so the app's
  // own routes take over once mounted.
  const [demo, setDemo] = useState(() => window.location.pathname === '/demo');
  const [signupAfterDemo, setSignupAfterDemo] = useState(false);
  useEffect(() => {
    if (window.location.pathname === '/demo') window.history.replaceState(null, '', '/');
  }, []);

  if (token) return <GuestSharePage token={token} />;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  // Returning from a password-reset link: collect a new password even though a
  // (limited) recovery session exists, then proceed once it's set.
  if (recovery) return <AuthScreen initialMode="reset" onResetDone={clearRecovery} />;

  // No account needed: drop into a seeded local demo. Leaving it routes to sign-up.
  if (!session && demo) {
    return <DemoApp onSignUp={() => { setSignupAfterDemo(true); setDemo(false); }} />;
  }

  if (!session) {
    return (
      <AuthScreen
        initialMode={signupAfterDemo ? 'signup' : undefined}
        onTryDemo={() => setDemo(true)}
      />
    );
  }

  return <AuthedApp user={session.user} />;
}
