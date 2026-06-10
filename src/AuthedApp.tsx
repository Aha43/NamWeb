import { AppShell } from './AppShell';
import { supabase } from './lib/supabase';
import { useWorkspace } from './store/useWorkspace';

/** Mounted only once authenticated; owns the workspace and renders the shell. */
export function AuthedApp() {
  const workspace = useWorkspace();
  return <AppShell workspace={workspace} onSignOut={() => void supabase.auth.signOut()} />;
}
