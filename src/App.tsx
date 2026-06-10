import { AuthedApp } from './AuthedApp';
import { Login } from './auth/Login';
import { useSession } from './auth/useSession';

/** Auth gate: shows the login form until there is a session, then the app. */
export default function App() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!session) return <Login />;

  return <AuthedApp />;
}
