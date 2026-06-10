// Workspace sync client — reads and writes the same Supabase `workspaces` row the
// NamDesktop cloud-sync feature uses. The whole workspace is a single JSONB blob
// guarded by an optimistic `version` counter.
//
// Contract (source of truth: NamDesktop SupabaseSyncService):
//   pull: SELECT the user's row for `name` → {document, version} or noRemote
//   push: version-guarded UPDATE (set version = guard + 1 WHERE version == guard).
//         0 rows updated ⇒ either first push (no row yet → INSERT) or a conflict
//         (a row exists at a different version → report its version).
//
// Migrations live in NamDesktop; this client only consumes the table.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceDocument } from '../domain/types';

const TABLE = 'workspaces';

export type PullResult =
  | { kind: 'ok'; document: WorkspaceDocument; version: number }
  | { kind: 'noRemote' }
  | { kind: 'error'; message: string };

export type PushResult =
  | { kind: 'ok'; version: number }
  | { kind: 'conflict'; remoteVersion: number }
  | { kind: 'error'; message: string };

async function currentUserId(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.auth.getSession();
  if (error) return null;
  return data.session?.user?.id ?? null;
}

/** Fetch the user's workspace row for `name`. */
export async function pull(client: SupabaseClient, name: string): Promise<PullResult> {
  const uid = await currentUserId(client);
  if (!uid) return { kind: 'error', message: 'Not authenticated' };

  const { data, error } = await client
    .from(TABLE)
    .select('version, document')
    .eq('owner_user_id', uid)
    .eq('name', name)
    .maybeSingle();

  if (error) return { kind: 'error', message: error.message };
  if (!data) return { kind: 'noRemote' };
  return { kind: 'ok', document: data.document as WorkspaceDocument, version: data.version as number };
}

/**
 * Push `document` guarded on `guardVersion`. Pass 0 for a never-synced workspace
 * (the guarded update will match nothing and fall through to insert-or-conflict).
 */
export async function push(
  client: SupabaseClient,
  name: string,
  document: WorkspaceDocument,
  guardVersion: number,
): Promise<PushResult> {
  const uid = await currentUserId(client);
  if (!uid) return { kind: 'error', message: 'Not authenticated' };

  // Version-guarded update: bump to guardVersion + 1 only if the row is still at guardVersion.
  const updated = await client
    .from(TABLE)
    .update({ document, version: guardVersion + 1 })
    .eq('owner_user_id', uid)
    .eq('name', name)
    .eq('version', guardVersion)
    .select('version');

  if (updated.error) return { kind: 'error', message: updated.error.message };
  const rows = (updated.data ?? []) as { version: number }[];
  if (rows.length === 1) return { kind: 'ok', version: rows[0].version };

  // Matched nothing → first push or a version conflict. Disambiguate by fetching.
  const existing = await client
    .from(TABLE)
    .select('version')
    .eq('owner_user_id', uid)
    .eq('name', name)
    .maybeSingle();

  if (existing.error) return { kind: 'error', message: existing.error.message };

  if (!existing.data) {
    const inserted = await client
      .from(TABLE)
      .insert({ owner_user_id: uid, name, version: 1, document })
      .select('version')
      .single();
    if (inserted.error) return { kind: 'error', message: inserted.error.message };
    return { kind: 'ok', version: (inserted.data as { version: number }).version };
  }

  return { kind: 'conflict', remoteVersion: (existing.data as { version: number }).version };
}
