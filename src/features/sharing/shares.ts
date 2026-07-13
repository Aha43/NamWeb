// The owner-side share service (#759): thin supabase CRUD over `project_shares`. One share
// per (owner, project); rotation swaps the token in place. Guests never touch this module —
// their single read path is the get_project_share RPC (stage 2).

import { supabase } from '@/lib/supabase';
import { newShareToken } from '@/lib/shareToken';
import type { ShareContent } from '@/domain/shareContent';

export interface ProjectShare {
  token: string;
  project_id: string;
  content: ShareContent;
  enabled: boolean;
  updated_at: string;
}

/** The owner's share for a project, or null when unpublished. RLS scopes to the caller. */
export async function fetchShare(projectId: string): Promise<ProjectShare | null> {
  const { data, error } = await supabase
    .from('project_shares')
    .select('token, project_id, content, enabled, updated_at')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProjectShare | null) ?? null;
}

/** Publish (insert) or republish (update content) — the upsert rides the (owner, project)
 *  uniqueness; the token is minted once at first publish and survives republishes. */
export async function publishShare(
  ownerUserId: string,
  projectId: string,
  content: ShareContent,
  existingToken?: string,
): Promise<ProjectShare> {
  const token = existingToken ?? newShareToken();
  const { data, error } = await supabase
    .from('project_shares')
    .upsert(
      {
        token,
        owner_user_id: ownerUserId,
        project_id: projectId,
        content,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_user_id,project_id' },
    )
    .select('token, project_id, content, enabled, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectShare;
}

/** Revoke: the row dies, the link goes dark immediately. */
export async function unpublishShare(token: string): Promise<void> {
  const { error } = await supabase.from('project_shares').delete().eq('token', token);
  if (error) throw new Error(error.message);
}

/** Rotate: a new secret replaces the old in place — the old link dies, content survives. */
export async function rotateShareToken(oldToken: string): Promise<string> {
  const token = newShareToken();
  const { error } = await supabase
    .from('project_shares')
    .update({ token, updated_at: new Date().toISOString() })
    .eq('token', oldToken);
  if (error) throw new Error(error.message);
  return token;
}

/** The guest read path (#761): the RPC, and only the RPC — the table is dark to anon.
 *  Unknown and revoked tokens are the same null (no oracle). */
export async function fetchGuestShare(token: string): Promise<ShareContent | null> {
  const { data, error } = await supabase.rpc('get_project_share', { share_token: token });
  if (error) throw new Error(error.message);
  return (data as ShareContent | null) ?? null;
}

/** The guest URL for a token — path-based (`/p/<token>`), served by the SPA (stage 2). */
export function shareUrl(token: string): string {
  return `${window.location.origin}/p/${token}`;
}
