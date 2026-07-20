// The owner-side share service (#759): thin supabase CRUD over `project_shares`. One share
// per (owner, project); rotation swaps the token in place. Guests never touch this module —
// their single read path is the get_project_share RPC (stage 2).

import { supabase } from '@/lib/supabase';
import { newShareToken } from '@/lib/shareToken';
export { canonicalSnapshot } from '@/lib/canonicalJson';
import type { ShareContent } from '@/domain/shareContent';

export interface ProjectShare {
  token: string;
  /** Stable across token rotation (#772/F6) — what suggestions hang off. */
  share_id: string;
  project_id: string;
  content: ShareContent;
  enabled: boolean;
  updated_at: string;
}

/** A guest's captured input (#796) — the owner clarifies it, never the guest. */
export interface ShareSuggestion {
  id: number;
  share_id: string;
  guest_name: string | null;
  body: string;
  node_id: string | null;
  handled: boolean;
  created_at: string;
}

/** The owner's share for a project, or null when unpublished. RLS scopes to the caller. */
export async function fetchShare(projectId: string): Promise<ProjectShare | null> {
  const { data, error } = await supabase
    .from('project_shares')
    .select('token, share_id, project_id, content, enabled, updated_at')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProjectShare | null) ?? null;
}

/** First publish inserts with a fresh token; republish updates CONTENT only, keyed by
 *  (owner, project) — never the token (#772/F3: a stale dialog's republish must not write an
 *  old token back over a rotation performed for security). The row's CURRENT token comes back,
 *  so a stale caller heals. A republish that matches NO row returns null (#774): the share was
 *  unpublished elsewhere — deliberately revoked — and silently minting a fresh link against
 *  that intent is the F3 bug in different clothes. The caller decides what to tell the user. */
export async function publishShare(
  ownerUserId: string,
  projectId: string,
  content: ShareContent,
  republish = false,
): Promise<ProjectShare | null> {
  if (republish) {
    const { data, error } = await supabase
      .from('project_shares')
      .update({ content, enabled: true, updated_at: new Date().toISOString() })
      .eq('owner_user_id', ownerUserId)
      .eq('project_id', projectId)
      .select('token, share_id, project_id, content, enabled, updated_at')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as ProjectShare | null) ?? null;
  }
  const { data, error } = await supabase
    .from('project_shares')
    .insert({
      token: newShareToken(),
      owner_user_id: ownerUserId,
      project_id: projectId,
      content,
      enabled: true,
      updated_at: new Date().toISOString(),
    })
    .select('token, share_id, project_id, content, enabled, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectShare;
}

/** Revoke: the row dies, the link goes dark immediately. */
export async function unpublishShare(token: string): Promise<void> {
  const { error } = await supabase.from('project_shares').delete().eq('token', token);
  if (error) throw new Error(error.message);
}

/** Rotate: a new secret replaces the old in place — the old link dies, content survives.
 *  Verified by row count (#772/F3): a raced rotate (someone else rotated first) must fail
 *  loudly, not show a link that was never written. */
export async function rotateShareToken(oldToken: string): Promise<string> {
  const token = newShareToken();
  const { data, error } = await supabase
    .from('project_shares')
    .update({ token, updated_at: new Date().toISOString() })
    .eq('token', oldToken)
    .select('token');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('share changed elsewhere — reopen the dialog');
  return token;
}


/** The guest read path (#761): the RPC, and only the RPC — the table is dark to anon.
 *  Unknown and revoked tokens are the same null (no oracle). */
export async function fetchGuestShare(token: string): Promise<ShareContent | null> {
  const { data, error } = await supabase.rpc('get_project_share', { share_token: token });
  if (error) throw new Error(error.message);
  return (data as ShareContent | null) ?? null;
}

/** The guest write path (#796): the RPC, boolean out — unknown/disabled/over-cap all read the
 *  same false (no oracle). */
export async function submitSuggestion(
  token: string,
  suggestion: string,
  guestName?: string,
  nodeId?: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('add_share_suggestion', {
    share_token: token,
    suggestion,
    guest: guestName ?? null,
    node: nodeId ?? null,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/** A guest tick on a delegated resource (#810): the RPC, boolean out — unknown/disabled/
 *  malformed/over-cap all read the same false (no oracle; a refused tap just doesn't move). */
export async function submitResourceEvent(
  token: string,
  nodeId: string,
  resIndex: number,
  delta: 1 | -1,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('add_share_resource_event', {
    share_token: token,
    node: nodeId,
    res_index: resIndex,
    delta,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/** A guest answer on a delegated question (#827): the RPC, boolean out — same quiet-false
 *  contract as the tick (no oracle; a refused answer just doesn't stick). */
export async function submitAnswerEvent(
  token: string,
  nodeId: string,
  resIndex: number,
  answer: 'yes' | 'no' | 'clear',
): Promise<boolean> {
  const { data, error } = await supabase.rpc('add_share_answer_event', {
    share_token: token,
    node: nodeId,
    res_index: resIndex,
    answer,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export interface ShareResourceEvent {
  node_id: string;
  res_index: number;
  /** A counter tick carries delta; a question answer carries answer — exactly one. */
  delta: number | null;
  answer: 'yes' | 'no' | 'clear' | null;
}

/** The guest overlay read (#810): undrained events for an enabled share, oldest first.
 *  Unknown and disabled tokens read as an empty list. */
export async function fetchShareResourceEvents(token: string): Promise<ShareResourceEvent[]> {
  const { data, error } = await supabase.rpc('get_share_resource_events', { share_token: token });
  if (error) throw new Error(error.message);
  return (data as ShareResourceEvent[] | null) ?? [];
}

/** The owner's shares (RLS scopes to the owner) — the drain's work list (#811). */
export async function fetchOwnerShares(): Promise<Pick<ProjectShare, 'token' | 'share_id' | 'project_id'>[]> {
  const { data, error } = await supabase.from('project_shares').select('token, share_id, project_id');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The kinds a drain can apply — server-enforced by claim_drainable_events (#832/P1). */
export const DRAINABLE_KINDS = ['delta', 'answer'] as const;

/** One drainable guest event as the owner sees it — the drain's unit of work (claimed or leftover). */
export interface DrainRow {
  id: number;
  node_id: string;
  res_index: number;
  /** A counter tick carries delta; a question answer carries answer — exactly one. */
  delta: number | null;
  answer: 'yes' | 'no' | 'clear' | null;
}

/** Claim this share's undrained events of supported KINDS, atomically, via the owner-scoped
 *  RPC (#832/P1 — direct UPDATE is revoked, so an old bundle fails closed). Two devices
 *  draining concurrently still split the batch (the UPDATE ... RETURNING is atomic); an
 *  unknown kind stays unclaimed for a newer client. Rows come back id-ordered (#850). Returns
 *  the rows THIS caller won. */
export async function claimDrainableEvents(shareId: string, kinds: readonly string[]): Promise<DrainRow[]> {
  const { data, error } = await supabase.rpc('claim_drainable_events', { p_share_id: shareId, p_kinds: kinds as string[] });
  if (error) throw new Error(error.message);
  return (data ?? []) as DrainRow[];
}

/** The most leftover rows one drain fetches. Bounds the query so a large un-deleted backlog can't
 *  silently truncate to an arbitrary subset (the PostgREST default cap): a full page (`=== LIMIT`)
 *  signals a possibly-incomplete working set, which the drain uses to SKIP ledger pruning (#850 —
 *  pruning a possibly-live id would re-introduce a double-apply). Ordered by id so the subset is the
 *  OLDEST leftovers and deterministic; the rest are drained on the next pass. */
export const DRAIN_LEFTOVER_LIMIT = 1000;

/** Claimed rows left by a previous session (#823/P2, #850): with the idempotency ledger they are
 *  recoverable, so the drain re-processes them (a no-op if they in fact landed) rather than blindly
 *  deleting. Returns FULL rows (oldest first, bounded) so the drain can re-plan them. */
export async function fetchLeftoverDrained(shareId: string): Promise<DrainRow[]> {
  const { data, error } = await supabase
    .from('share_resource_events')
    .select('id, node_id, res_index, delta, answer')
    .eq('share_id', shareId)
    .eq('drained', true)
    .order('id', { ascending: true })
    .limit(DRAIN_LEFTOVER_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as DrainRow[];
}

/** Remove landed events (#821): drained rows serve nothing and would ratchet the lifetime
 *  cap toward a permanently deaf share — the suggestion-cap lesson, one table over. */
export async function deleteEvents(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc('delete_drained_events', { p_ids: ids });
  if (error) throw new Error(error.message);
}

/** The share's queued guest ticks at this moment — counted BEFORE the dialog's drain lands
 *  (and deletes) them, so the line reads "since your last look" (#821). */
export async function countShareEvents(shareId: string): Promise<number> {
  const { count, error } = await supabase
    .from('share_resource_events')
    .select('id', { count: 'exact', head: true })
    .eq('share_id', shareId)
    .eq('drained', false); // open queue only (#823/P2): inert leftovers must not inflate the line
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** The owner's unhandled suggestions for a share, oldest first (RLS scopes to the owner). */
export async function fetchSuggestions(shareId: string): Promise<ShareSuggestion[]> {
  const { data, error } = await supabase
    .from('share_suggestions')
    .select('id, share_id, guest_name, body, node_id, handled, created_at')
    .eq('share_id', shareId)
    .eq('handled', false)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ShareSuggestion[]) ?? [];
}

/** Resolve a suggestion — adopted into the inbox or dismissed, either way it leaves the tray. */
export async function resolveSuggestion(id: number): Promise<void> {
  const { error } = await supabase.from('share_suggestions').update({ handled: true }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** The guest URL for a token — path-based (`/p/<token>`), served by the SPA (stage 2). */
export function shareUrl(token: string): string {
  return `${window.location.origin}/p/${token}`;
}
