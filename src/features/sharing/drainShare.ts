import type { Intent } from '@/domain/mutations';
import type { WorkspaceDocument } from '@/domain/types';
import { nowIso } from '@/lib/local';
import { guestIdMap } from '@/domain/shareContent';
import {
  DRAINABLE_KINDS,
  DRAIN_LEASE_TTL_SECONDS,
  DRAIN_LEFTOVER_LIMIT,
  acquireDrainLease,
  claimDrainableEvents,
  deleteEvents,
  fetchLeftoverDrained,
  releaseDrainLease,
  type DrainRow,
} from './shares';
import { drainPlan } from './drainEvents';

/**
 * Drain one share's guest events into the workspace (#811, redesigned #850). Two layers of ordering:
 *
 * 1. A per-share LEASE (#852) serializes drains across tabs/devices — exactly one drains a share at a
 *    time. This is what makes the `drainedThrough` watermark correct: without it, two tabs claiming
 *    time-separated events could commit out of order and skip a lower one (a lost tick). A tab that
 *    can't get the lease skips quietly, retried on the next trigger.
 * 2. Within a drain, events apply in id order, and idempotency is the per-resource watermark: the
 *    reducer applies an event only if its id exceeds the watermark, then advances it. Re-processing a
 *    leftover / conflict-replay is a safe no-op, and there is nothing to evict.
 *
 * Everything keys off the COMMITTED document, never the optimistic snapshot: a failed local edit (e.g.
 * removing a delegated resource) must not make a valid event look like junk and get deleted. So we plan
 * against the committed doc, dispatch in id order, `await flush()`, then decide against the committed doc:
 *   - id ≤ the committed watermark → DURABLY APPLIED → delete.
 *   - yields no intent against the committed doc → structural junk → delete.
 *   - otherwise (a failed/pending write) → LEAVE CLAIMED for the next drain.
 *
 * Leftovers are processed oldest-id-first, and when the leftover set is incomplete (failed or full/
 * truncated page) newer claims are DEFERRED — so the watermark can't jump past an unseen lower event.
 *
 * Returns the number of events this drain resolved (applied or spent).
 */
export async function drainShare(
  getCommittedDocument: () => WorkspaceDocument | null,
  dispatch: (intent: Intent) => void,
  flush: () => Promise<boolean>,
  share: { share_id: string; project_id: string; token: string },
): Promise<number> {
  const lease = await acquireDrainLease(share.share_id, DRAIN_LEASE_TTL_SECONDS).catch(() => null);
  if (!lease) return 0; // another tab is draining this share — serialized; retried on the next trigger
  try {
    return await drainHeld(getCommittedDocument, dispatch, flush, share);
  } finally {
    await releaseDrainLease(share.share_id, lease).catch(() => {}); // best-effort; the TTL backs it up
  }
}

/** The drain body, run under the held lease. */
async function drainHeld(
  getCommittedDocument: () => WorkspaceDocument | null,
  dispatch: (intent: Intent) => void,
  flush: () => Promise<boolean>,
  share: { share_id: string; project_id: string; token: string },
): Promise<number> {
  let leftovers: DrainRow[];
  let leftoversComplete: boolean;
  try {
    leftovers = await fetchLeftoverDrained(share.share_id);
    leftoversComplete = leftovers.length < DRAIN_LEFTOVER_LIMIT; // a full page may be truncated
  } catch {
    leftovers = [];
    leftoversComplete = false;
  }
  // Only claim NEW (higher-id) events once we've seen every older leftover — else applying a newer
  // event would advance the watermark past an unseen lower one (a lost tick). Deferred events stay
  // undrained for the next complete drain.
  const claimed = leftoversComplete ? await claimDrainableEvents(share.share_id, DRAINABLE_KINDS) : [];
  const working = [...new Map([...leftovers, ...claimed].map((e) => [e.id, e])).values()].sort(
    (a, b) => a.id - b.id,
  );
  if (working.length === 0) return 0;

  const before = getCommittedDocument();
  if (!before) return 0; // no committed truth to plan against — retried on the next trigger

  const applied = (doc: WorkspaceDocument | null, eventId: number, nodeId: string | undefined, index: number): boolean =>
    !!doc && !!nodeId && eventId <= (doc.nodes[nodeId]?.drainedThrough?.[index] ?? 0);

  // Dispatch each planned intent in id order, skipping any already at/under the committed watermark
  // (an idempotent no-op that would still cost a version-bumping push).
  const plan = drainPlan(before, share.project_id, share.token, working, nowIso());
  for (const p of plan) {
    if (!applied(before, p.eventId, p.nodeId, p.index)) dispatch(p.intent);
  }
  await flush();

  // Decide fate against the POST-FLUSH committed doc.
  const after = getCommittedDocument() ?? before;
  const afterMap = guestIdMap(after, share.project_id, share.token);
  const plannableAfter = new Set(
    drainPlan(after, share.project_id, share.token, working, nowIso()).map((p) => p.eventId),
  );
  const deleteIds: number[] = [];
  for (const e of working) {
    const isApplied = applied(after, e.id, afterMap.get(e.node_id), e.res_index);
    const junk = !plannableAfter.has(e.id); // yields no intent against the committed doc
    if (isApplied || junk) deleteIds.push(e.id);
    // else: applicable but not yet landed (a failed/pending write) — leave claimed
  }
  if (deleteIds.length === 0) return 0;

  const deleted = await deleteEvents(deleteIds).then(() => true).catch(() => false);
  return deleted ? deleteIds.length : 0; // on delete failure the rows stay; next drain re-processes idempotently
}
