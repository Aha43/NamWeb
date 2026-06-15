import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface SessionState {
  session: Session | null;
  loading: boolean;
  /** True after the user returns via a password-reset link (PASSWORD_RECOVERY) — show the set-password form even though a (limited) session exists. */
  recovery: boolean;
  /** Clear the recovery flag once the new password is set, so the app proceeds. */
  clearRecovery: () => void;
}

/** Tracks the current Supabase auth session, reacting to sign-in / sign-out / recovery. */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const clearRecovery = useCallback(() => setRecovery(false), []);

  return { session, loading, recovery, clearRecovery };
}
