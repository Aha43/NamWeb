import { useEffect, useState } from 'react';
import { fetchOwnerShares } from './shares';

/**
 * The set of project ids the owner has published as a share (#857), fetched once on mount from
 * `project_shares` (RLS-scoped to the owner). `null` while the first fetch is in flight; an empty
 * set on error (offline / RLS hiccup) — the list just shows nothing shared, retried on remount.
 * Powers both the Shared view and the "shared" badge on the ordinary projects list.
 */
export function useSharedProjectIds(): Set<string> | null {
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(() => {
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
  }, []);
  return ids;
}
