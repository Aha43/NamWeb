// One-time migration (#1195): stamp a stable `id` onto every workspace resource that predates ids.
//
// New resources (add_resource) already carry an `id`; legacy ones don't, so they can only be addressed
// by array index — the shifting-index trap remove_resource/edit_resource were hardened against. This
// backfills the rest so NO resource needs index addressing, closing the trap for good.
//
// Deliberately NOT wired into pull/load or applyIntent: the ids are random (non-deterministic), so a
// load-time heal would break the pure/replayable ingest path AND regenerate different ids per pull
// until persisted (unstable addressing). A one-shot that persists once avoids both — run it, push it,
// done. The id generator is injected so this stays a pure, deterministically-testable function.

import type { WorkspaceDocument } from './types';

/**
 * Stamp `genId()` onto every resource in `doc` that has no `id`. Mutates `doc` in place; returns the
 * number of resources stamped (0 = nothing to migrate / already done — the migration is idempotent).
 */
export function stampResourceIds(doc: WorkspaceDocument, genId: () => string): number {
  let stamped = 0;
  for (const node of Object.values(doc.nodes)) {
    for (const resource of node.resources) {
      if (!resource.id) {
        resource.id = genId();
        stamped += 1;
      }
    }
  }
  return stamped;
}
