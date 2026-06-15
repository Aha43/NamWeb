import { AuthedApp } from './AuthedApp';
import { AuthScreen } from './auth/AuthScreen';
import { useSession } from './auth/useSession';

/** Auth gate: shows the auth screen until there is a session, then the app. */
export default function App() {
  const { session, loading, recovery, clearRecovery } = useSession();

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

  if (!session) return <AuthScreen />;

  return <AuthedApp />;
}
