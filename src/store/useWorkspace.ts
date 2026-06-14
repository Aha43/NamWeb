// React hook owning the workspace document: loads the synced workspace row on
// mount, holds the snapshot, and dispatches intents through the serialized
// conflict-retry commit. Writes are single-flight (a promise chain) so two taps
// can't race the optimistic version guard. Reads stay snappy via an immediate
// optimistic apply.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getWorkspaceName } from '../lib/workspace';
import { pull } from '../sync/workspaceClient';
import { subscribeToWorkspace } from '../sync/realtime';
import { applyIntent, type Intent } from '../domain/mutations';
import { commitIntent, type WorkspaceSnapshot } from './commit';
import type { WorkspaceDocument } from '../domain/types';

export interface UseWorkspace {
  document: WorkspaceDocument | null;
  loading: boolean;
  /** Load error (failed initial pull). */
  error: string | null;
  /** No workspace row yet — the desktop must push one first. */
  noRemote: boolean;
  /** Transient sync notice (conflict reloaded / sync failed); auto-dismisses, or clearNotice. */
  notice: string | null;
  clearNotice: () => void;
  /** Re-run the initial load (used by the load-error retry). */
  retry: () => void;
  dispatch: (intent: Intent) => void;
}

const NOTICE_TIMEOUT_MS = 4000;

export function useWorkspace(): UseWorkspace {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noRemote, setNoRemote] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Last server-confirmed snapshot — the base every commit guards against.
  const committedRef = useRef<WorkspaceSnapshot | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  // Outstanding local commits. While > 0 a write owns the row, so we ignore
  // Realtime nudges (the version guard reconciles in-flight writes itself).
  const inFlightRef = useRef(0);
  // Frozen at mount: the workspace row chosen at login (e.g. `dev`) drives this session.
  const workspaceNameRef = useRef(getWorkspaceName());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoRemote(false);
    const result = await pull(supabase, workspaceNameRef.current);
    if (result.kind === 'ok') {
      const snap = { document: result.document, version: result.version };
      committedRef.current = snap;
      setSnapshot(snap);
    } else if (result.kind === 'noRemote') {
      setNoRemote(true);
    } else {
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Signal-then-pull: a Realtime UPDATE on our workspace row is just a nudge to
  // re-pull. Adopt the remote snapshot only when it is strictly newer than our
  // confirmed base AND no local write is in flight — so own-write echoes and
  // stale events are no-ops, and in-flight commits self-reconcile via the guard.
  const reconcileFromRemote = useCallback(async () => {
    if (inFlightRef.current > 0) return;
    const result = await pull(supabase, workspaceNameRef.current);
    if (result.kind !== 'ok') return;
    const base = committedRef.current;
    if (!base || result.version <= base.version) return;
    if (inFlightRef.current > 0) return; // a write started while we pulled
    const snap = { document: result.document, version: result.version };
    committedRef.current = snap;
    setSnapshot(snap);
    setNotice('Updated from another device');
  }, []);

  // Subscribe to the workspace change feed once we know the signed-in user.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user || cancelled) return;
      // Ensure the Realtime socket carries the user JWT so RLS lets our row's
      // postgres_changes through (belt-and-suspenders over supabase-js auto-wiring).
      supabase.realtime.setAuth(session.access_token);
      unsubscribe = subscribeToWorkspace(supabase, session.user.id, () => void reconcileFromRemote());
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [reconcileFromRemote]);

  // Auto-dismiss the transient sync notice.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const dispatch = useCallback((intent: Intent) => {
    // Optimistic display update for immediate feedback.
    setSnapshot((s) => (s ? { document: applyIntent(s.document, intent), version: s.version } : s));

    inFlightRef.current += 1;
    queueRef.current = queueRef.current
      .then(async () => {
        const base = committedRef.current;
        if (!base) return;
        const result = await commitIntent(supabase, workspaceNameRef.current, base, intent);
        committedRef.current = result.snapshot;
        setSnapshot(result.snapshot);
        if (result.outcome !== 'synced') setNotice(result.message ?? 'Sync failed');
      })
      .finally(() => {
        inFlightRef.current -= 1;
      });
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);
  const retry = useCallback(() => void load(), [load]);

  return {
    document: snapshot?.document ?? null,
    loading,
    error,
    noRemote,
    notice,
    clearNotice,
    retry,
    dispatch,
  };
}
