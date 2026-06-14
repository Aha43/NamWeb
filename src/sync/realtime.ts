// Realtime change feed for the workspace row. A subscription is only a *nudge*:
// on any UPDATE to one of the user's `workspaces` rows we tell the caller to
// re-pull and reconcile (signal-then-pull). We deliberately do NOT trust the
// payload — own-write echoes, stale events and other-workspace rows all collapse
// to a cheap, version-guarded re-pull. This keeps Realtime out of the merge path.
//
// Requires `workspaces` in the `supabase_realtime` publication (migration lives in
// NamDesktop). RLS scopes deliveries to the owning user, so the owner filter below
// is a narrowing optimisation, not the security boundary.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'workspaces';

/**
 * Subscribe to UPDATEs of the user's workspace rows. Calls `onSignal` once per
 * change event (no payload — the caller re-pulls). Returns an unsubscribe fn.
 */
export function subscribeToWorkspace(
  client: SupabaseClient,
  ownerUserId: string,
  onSignal: () => void,
): () => void {
  const channel: RealtimeChannel = client
    .channel(`workspaces:${ownerUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: TABLE,
        filter: `owner_user_id=eq.${ownerUserId}`,
      },
      () => onSignal(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
