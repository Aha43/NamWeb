// React hook owning the workspace document: loads the synced workspace row on
// mount, holds the snapshot, and dispatches intents through the serialized
// conflict-retry commit. Writes are single-flight (a promise chain) so two taps
// can't race the optimistic version guard. Reads stay snappy via an immediate
// optimistic apply.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getWorkspaceName } from '../lib/workspace';
import { pull, push } from '../sync/workspaceClient';
import { subscribeToWorkspace } from '../sync/realtime';
import { createDefaultWorkspace } from '../domain/createWorkspace';
import { applyIntent, type Intent } from '../domain/mutations';
import { commitIntent, type WorkspaceSnapshot } from './commit';
import type { WorkspaceDocument } from '../domain/types';

/**
 * A cross-surface sync notice. `info` (e.g. "applied a change from another device") auto-dismisses;
 * `error` (a write didn't reach the server) is **sticky** and offers Retry — so a local-only change
 * never silently reads as saved.
 */
export interface SyncNotice {
  kind: 'info' | 'error';
  /** Translation key for the notice text — translated at render (SyncNotice), so the banner
   *  follows the app language (#580). */
  messageKey: string;
  /** Optional raw (server-provided) detail that overrides the key — untranslatable by nature. */
  raw?: string;
}

export interface UseWorkspace {
  document: WorkspaceDocument | null;
  loading: boolean;
  /** Load error (failed initial pull). */
  error: string | null;
  /** No workspace row yet — offer to bootstrap one (createWorkspace). */
  noRemote: boolean;
  /** A createWorkspace() bootstrap is in flight. */
  creating: boolean;
  /** Bootstrap an empty workspace for a brand-new (web-only) user. */
  createWorkspace: () => void;
  /** Cross-surface sync notice — `info` auto-dismisses; `error` is sticky with Retry. */
  notice: SyncNotice | null;
  clearNotice: () => void;
  /** Re-run the initial load (used by the load-error retry). */
  retry: () => void;
  /** Re-push the current local document after a failed write (the error-notice Retry). */
  retrySync: () => void;
  dispatch: (intent: Intent) => void;
  /** Await everything dispatched SO FAR reaching the backend; resolves true when every write
   *  confirmed, false when a write failed (the sticky error + Retry own recovery). The guest
   *  drain (#823/P1) deletes its claimed events only on true. */
  flush: () => Promise<boolean>;
}

const NOTICE_TIMEOUT_MS = 4000;
const INFO_FROM_DEVICE = 'sync.reconciledFromDevice';
const ERROR_SAVE = 'sync.saveFailed';

export function useWorkspace(): UseWorkspace {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noRemote, setNoRemote] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<SyncNotice | null>(null);

  // Last server-confirmed snapshot — the base every commit guards against.
  const committedRef = useRef<WorkspaceSnapshot | null>(null);
  // Latest optimistic snapshot (incl. unsynced edits) — what Retry re-pushes after a failed write.
  const snapshotRef = useRef<WorkspaceSnapshot | null>(null);
  snapshotRef.current = snapshot;
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  // Outstanding local commits. While > 0 a write owns the row, so we ignore
  // Realtime nudges (the version guard reconciles in-flight writes itself).
  const inFlightRef = useRef(0);
  // Set when a commit fails: the optimistic doc now holds an unconfirmed edit that only Retry (a
  // whole-document re-push) can reconcile. While set, we pause draining further per-intent commits
  // and skip Realtime reconcile, so neither can build on / clobber the unconfirmed state (#507).
  const failedRef = useRef(false);
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
      failedRef.current = false; // a clean server state resolves any prior failed write
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

  // Bootstrap an empty workspace for a brand-new user (no desktop app needed).
  // Inserts a fresh row (push at guard version 0). A concurrent create from
  // another device surfaces as a conflict — adopt it by reloading.
  const createWorkspace = useCallback(async () => {
    setCreating(true);
    setNotice(null);
    const document = createDefaultWorkspace();
    const result = await push(supabase, workspaceNameRef.current, document, 0);
    if (result.kind === 'ok') {
      const snap = { document, version: result.version };
      committedRef.current = snap;
      setSnapshot(snap);
      setNoRemote(false);
    } else if (result.kind === 'conflict') {
      await load();
    } else {
      setNotice({ kind: 'error', messageKey: 'sync.createFailed', raw: result.message ?? undefined });
    }
    setCreating(false);
  }, [load]);

  // Signal-then-pull: a Realtime UPDATE on our workspace row is just a nudge to
  // re-pull. Adopt the remote snapshot only when it is strictly newer than our
  // confirmed base AND no local write is in flight — so own-write echoes and
  // stale events are no-ops, and in-flight commits self-reconcile via the guard.
  const reconcileFromRemote = useCallback(async () => {
    if (inFlightRef.current > 0) return;
    if (failedRef.current) return; // an unconfirmed failed edit is pending — don't let a remote pull clobber it
    const result = await pull(supabase, workspaceNameRef.current);
    if (result.kind !== 'ok') return;
    const base = committedRef.current;
    if (!base || result.version <= base.version) return;
    if (inFlightRef.current > 0) return; // a write started while we pulled
    const snap = { document: result.document, version: result.version };
    committedRef.current = snap;
    setSnapshot(snap);
    setNotice({ kind: 'info', messageKey: 'sync.updatedFromDevice' });
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

  // Auto-dismiss only `info` notices; errors stay until dismissed or retried (don't let a
  // local-only change quietly disappear from view as if it had saved).
  useEffect(() => {
    if (notice?.kind !== 'info') return;
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
        // A prior write failed: the optimistic doc holds unconfirmed edits that this intent's
        // optimistic apply has already stacked onto `snapshot`. Don't commit it against the stale
        // `committedRef` — that would push a document missing the earlier edits and, on success,
        // overwrite them. Leave it for Retry, which re-pushes the whole current document (#507).
        if (failedRef.current) return;
        const result = await commitIntent(supabase, workspaceNameRef.current, base, intent);
        if (result.outcome === 'error') {
          // The write failed. Keep the optimistic edit visible and leave `committedRef` at the
          // confirmed base, so the edit stays recoverable: Retry re-pushes the current local
          // document (with the edit) guarded on the right version. Do NOT adopt `result.snapshot`
          // here — for an error it's the confirmed base, and assigning it would silently drop the
          // edit and let a later re-push of the unchanged document masquerade as recovery (#484).
          failedRef.current = true;
          setNotice({ kind: 'error', messageKey: ERROR_SAVE });
          return;
        }
        committedRef.current = result.snapshot;
        // Adopt into the display only when this is the last write in flight: mid-burst (bulk
        // resolve/delete, the wizard's Done), this snapshot is base + this intent only, and
        // adopting it would rewind the optimistic view of the still-queued intents — the
        // removed-items-come-back flicker (#650). The burst's final commit converges the display,
        // including the reloaded-from-remote case (later commits build on the reloaded base).
        if (inFlightRef.current === 1) setSnapshot(result.snapshot);
        if (result.outcome === 'reloaded') setNotice({ kind: 'info', messageKey: INFO_FROM_DEVICE });
      })
      .finally(() => {
        inFlightRef.current -= 1;
      });
  }, []);

  const flush = useCallback(async () => {
    await queueRef.current;
    return !failedRef.current;
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);
  const retry = useCallback(() => void load(), [load]);

  // Retry a failed write: re-push the *whole* current local document (all unconfirmed edits),
  // guarded on the last confirmed version.
  const retrySync = useCallback(() => {
    if (!committedRef.current || !snapshotRef.current) return;
    setNotice(null);
    inFlightRef.current += 1;
    queueRef.current = queueRef.current
      .then(async () => {
        // Read the latest committed/optimistic state when the push actually runs (edits may have
        // been made after Retry was clicked while the queue drained).
        const base = committedRef.current;
        const current = snapshotRef.current;
        if (!base || !current) return;
        const result = await push(supabase, workspaceNameRef.current, current.document, base.version);
        if (result.kind === 'ok') {
          const snap = { document: current.document, version: result.version };
          committedRef.current = snap;
          setSnapshot(snap);
          failedRef.current = false; // recovered — resume normal per-intent commits
        } else if (result.kind === 'conflict') {
          setNotice({ kind: 'info', messageKey: INFO_FROM_DEVICE });
          failedRef.current = false; // load() adopts the remote state, resolving the failure
          await load();
        } else {
          setNotice({ kind: 'error', messageKey: ERROR_SAVE }); // still failed — stay paused
        }
      })
      .finally(() => {
        inFlightRef.current -= 1;
      });
  }, [load]);

  return {
    document: snapshot?.document ?? null,
    loading,
    error,
    noRemote,
    creating,
    createWorkspace: () => void createWorkspace(),
    notice,
    clearNotice,
    retry,
    retrySync,
    dispatch,
    flush,
  };
}
