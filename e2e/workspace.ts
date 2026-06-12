import { createClient } from '@supabase/supabase-js';
import { E2E } from './env';
import { emptyDocument } from './seed';

// Per-test workspace isolation. Each browser project drives its OWN workspace row
// (`e2e-<project>`), so Chromium and WebKit never contend over one shared JSONB blob
// (the doc is single-writer, version-guarded — concurrent writers would conflict).

/** localStorage key the app reads to pick which workspace row to sync (src/lib/workspace.ts). */
export const WORKSPACE_STORAGE_KEY = 'namweb.workspaceName';

/** Replace `name`'s row with a fresh empty document, as the signed-in owner (RLS-scoped). */
export async function resetWorkspace(name: string): Promise<void> {
  const client = createClient(E2E.supabaseUrl, E2E.supabaseKey);
  const { data, error } = await client.auth.signInWithPassword({
    email: E2E.email,
    password: E2E.password,
  });
  if (error) throw new Error(`E2E sign-in failed: ${error.message}`);
  const owner_user_id = data.user.id;

  const del = await client
    .from('workspaces')
    .delete()
    .eq('owner_user_id', owner_user_id)
    .eq('name', name);
  if (del.error) throw new Error(`reset (delete) failed: ${del.error.message}`);

  const ins = await client
    .from('workspaces')
    .insert({ owner_user_id, name, version: 1, document: emptyDocument() });
  if (ins.error) throw new Error(`reset (seed) failed: ${ins.error.message}`);
}
