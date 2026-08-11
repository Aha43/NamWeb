// Commit an intent to the cloud with optimistic single-flight + intent-replay.
//
// 1. Apply the intent optimistically and push guarded on the held version.
// 2. On conflict, pull the latest document, re-apply the *same* intent onto it,
//    and push once more (guarded on the fresh version).
// 3. If the target node vanished remotely, or it still conflicts, give up the
//    retry (bounded) and surface the freshly pulled state as a "reloaded" notice.
//
// Pure and React-free so the conflict logic is unit-testable.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceDocument } from '../domain/types';
import { applyIntent, intentTargetExists, type Intent } from '../domain/mutations';
import { pull, push } from '../sync/workspaceClient';

export interface WorkspaceSnapshot {
  document: WorkspaceDocument;
  version: number;
}

export type CommitOutcome = 'synced' | 'reloaded' | 'error';

export interface CommitResult {
  snapshot: WorkspaceSnapshot;
  outcome: CommitOutcome;
  message?: string;
}

const RELOADED = 'Reloaded — synced from another device';

export interface CommitOptions {
  /**
   * On a version conflict, replay the intent onto the freshly-pulled document (the default). Set
   * `false` for an operation that must NOT re-apply against a base the caller never saw — e.g. a
   * destructive delete whose safety gate + manifest were computed on the caller's snapshot (#1092):
   * a stale replay could bypass the gate (a leaf that gained children) or misreport what it removed.
   * With it off, a conflict returns `reloaded` WITHOUT applying, so the caller re-reads and re-issues.
   */
  replayOnConflict?: boolean;
}

export async function commitIntent(
  client: SupabaseClient,
  name: string,
  base: WorkspaceSnapshot,
  intent: Intent,
  { replayOnConflict = true }: CommitOptions = {},
): Promise<CommitResult> {
  const optimistic = applyIntent(base.document, intent);

  const first = await push(client, name, optimistic, base.version);
  if (first.kind === 'ok') {
    return { snapshot: { document: optimistic, version: first.version }, outcome: 'synced' };
  }
  if (first.kind === 'error') {
    return { snapshot: base, outcome: 'error', message: first.message };
  }

  // Conflict — pull the latest and decide how to reconcile.
  const pulled = await pull(client, name);
  if (pulled.kind === 'error') {
    return { snapshot: base, outcome: 'error', message: pulled.message };
  }
  if (pulled.kind === 'noRemote') {
    // The row vanished; treat the intent's result as a first push.
    const reinsert = await push(client, name, optimistic, 0);
    if (reinsert.kind === 'ok') {
      return { snapshot: { document: optimistic, version: reinsert.version }, outcome: 'synced' };
    }
    const message = reinsert.kind === 'error' ? reinsert.message : RELOADED;
    return { snapshot: base, outcome: reinsert.kind === 'error' ? 'error' : 'reloaded', message };
  }

  const fresh: WorkspaceSnapshot = { document: pulled.document, version: pulled.version };

  // Opt-out of replay (#1092): the caller's decision (e.g. a delete's recursive-gate + manifest) was
  // made against `base`, not this freshly-pulled document — re-applying blind could be unsafe. Surface
  // the change and let the caller re-read and re-issue instead.
  if (!replayOnConflict) {
    return { snapshot: fresh, outcome: 'reloaded', message: RELOADED };
  }

  if (!intentTargetExists(pulled.document, intent)) {
    return { snapshot: fresh, outcome: 'reloaded', message: RELOADED };
  }

  const replay = applyIntent(pulled.document, intent);
  const second = await push(client, name, replay, pulled.version);
  if (second.kind === 'ok') {
    return { snapshot: { document: replay, version: second.version }, outcome: 'synced' };
  }
  if (second.kind === 'error') {
    return { snapshot: fresh, outcome: 'error', message: second.message };
  }
  // Still conflicting after one replay — bounded give-up.
  return { snapshot: fresh, outcome: 'reloaded', message: RELOADED };
}
