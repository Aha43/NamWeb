// React hook owning the workspace document: loads the `default` row on mount,
// holds the snapshot, and dispatches intents through the serialized conflict-retry
// commit. Writes are single-flight (a promise chain) so two taps can't race the
// optimistic version guard. Reads stay snappy via an immediate optimistic apply.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { pull } from '../sync/workspaceClient';
import { applyIntent, type Intent } from '../domain/mutations';
import { commitIntent, type WorkspaceSnapshot } from './commit';
import type { WorkspaceDocument } from '../domain/types';

const WORKSPACE_NAME = 'default';

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoRemote(false);
    const result = await pull(supabase, WORKSPACE_NAME);
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

  // Auto-dismiss the transient sync notice.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const dispatch = useCallback((intent: Intent) => {
    // Optimistic display update for immediate feedback.
    setSnapshot((s) => (s ? { document: applyIntent(s.document, intent), version: s.version } : s));

    queueRef.current = queueRef.current.then(async () => {
      const base = committedRef.current;
      if (!base) return;
      const result = await commitIntent(supabase, WORKSPACE_NAME, base, intent);
      committedRef.current = result.snapshot;
      setSnapshot(result.snapshot);
      if (result.outcome !== 'synced') setNotice(result.message ?? 'Sync failed');
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
