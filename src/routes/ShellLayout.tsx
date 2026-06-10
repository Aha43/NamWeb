import { AppShell } from '@/AppShell';
import { supabase } from '@/lib/supabase';

/** Wires sign-out into the presentational shell. */
export function ShellLayout() {
  return <AppShell onSignOut={() => void supabase.auth.signOut()} />;
}
