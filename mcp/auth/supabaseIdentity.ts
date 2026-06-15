// Supabase as the identity/login layer behind our OAuth Authorization Server (P1).
//
// The OAuth dance (DCR, PKCE, token endpoints) is the SDK's; the actual human
// authentication is Supabase email/password. Once we hold a user's Supabase
// session, every MCP request runs under *their* JWT, so `pull` is scoped by
// `owner_user_id` RLS exactly as the SPA is. No second identity domain.

import { createClient, type AuthSession, type SupabaseClient } from '@supabase/supabase-js';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

/** A fresh, session-less Supabase client (no local persistence, no auto-refresh). */
function anonClient(): SupabaseClient {
  return createClient(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Sign a user in with email/password; returns their Supabase session or throws. */
export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(error?.message ?? 'Sign-in failed');
  }
  return data.session;
}

/** The names of the workspace rows the user behind `session` owns (RLS-scoped). */
export async function listWorkspaceNames(session: AuthSession): Promise<string[]> {
  const { client } = await clientForSession(session);
  const { data, error } = await client
    .from('workspaces')
    .select('name')
    .eq('owner_user_id', session.user.id)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.name as string);
}

const EXPIRY_SKEW_SECONDS = 60;

function isExpired(session: AuthSession): boolean {
  if (!session.expires_at) return false;
  return session.expires_at <= Math.floor(Date.now() / 1000) + EXPIRY_SKEW_SECONDS;
}

/**
 * Build a Supabase client that acts as the user behind `session`, refreshing the
 * session first if it is at/near expiry. Returns the (possibly rotated) session so
 * the caller can persist it — Supabase rotates refresh tokens on every refresh.
 *
 * `setSession` is local (no network) for a live token, so `pull`'s `getSession()`
 * resolves the uid and PostgREST calls carry the JWT.
 */
export async function clientForSession(
  session: AuthSession,
): Promise<{ client: SupabaseClient; session: AuthSession }> {
  const client = anonClient();

  if (isExpired(session)) {
    const { data, error } = await client.auth.refreshSession({
      refresh_token: session.refresh_token,
    });
    if (error || !data.session) {
      throw new Error(`Supabase session refresh failed: ${error?.message ?? 'no session'}`);
    }
    return { client, session: data.session };
  }

  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return { client, session };
}
