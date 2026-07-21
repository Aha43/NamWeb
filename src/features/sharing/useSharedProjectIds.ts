import { useContext, useEffect, useState } from 'react';
import { AuthUserContext } from '@/auth/auth-context';
import { fetchOwnerShares } from './shares';

/**
 * The set of project ids the owner has published as a share (#857), fetched once on mount from
 * `project_shares` (RLS-scoped to the owner). `null` while the first fetch is in flight; an empty
 * set on error (offline / RLS hiccup) — the list just shows nothing shared, retried on remount.
 * Powers both the Shared view and the "shared" badge on the ordinary projects list.
 *
 * Sharing needs a real backend session, so the demo (`aud === 'demo'`) and any provider-less host
 * resolve to an empty set WITHOUT a fetch — the demo is documented offline and must not hit the
 * backend, and it has no shares to show anyway.
 */
export function useSharedProjectIds(): Set<string> | null {
  const user = useContext(AuthUserContext);
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!user || user.aud === 'demo') {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const shares = await fetchOwnerShares();
        if (!cancelled) setIds(new Set(shares.map((s) => s.project_id)));
      } catch {
        if (!cancelled) setIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);
  return ids;
}
