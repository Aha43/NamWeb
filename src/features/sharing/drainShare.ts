import type { Intent } from '@/domain/mutations';
import type { WorkspaceDocument } from '@/domain/types';
import { nowIso } from '@/lib/local';
import { guestIdMap } from '@/domain/shareContent';
import { DRAINABLE_KINDS, claimDrainableEvents, deleteEvents, fetchLeftoverDrained, type DrainRow } from './shares';
import { drainPlan } from './drainEvents';

/**
 * Drain one share's guest events into the workspace (#811, redesigned #850). Claim-then-apply: the
 * atomic claim splits the batch across concurrent devices; the document is read through a GETTER,
 * resolved AFTER the claim (#821/F2).
 *
 * The #832 fix — an idempotency ledger, not a batch-wide flush. Guests append ticks/answers; the
 * owner folds them in, and each resource's `drainLedger` (#850) remembers which event ids landed.
 * That makes the drain RESTARTABLE and each event's outcome DURABLE:
 *   - Events are dispatched in id order (a FIFO the ledger's `-1,+1` correctness relies on), then we
 *     await `flush()` and read the COMMITTED document (`getCommittedDocument`).
 *   - An event whose id is now in its resource's committed ledger DURABLY APPLIED → DELETE it.
 *   - An event that produced no intent (unresolved id, wrong type, un-delegated) is structural junk
 *     → DELETE (it can never apply; matches the guest overlay's drop).
 *   - Anything else (a first-ever apply that ERRORED, or a teardown race) is LEFT CLAIMED — the next
 *     drain re-processes it, and the ledger makes that re-processing a no-op if it in fact landed.
 * Deletion depends only on durable ledger state, never on a best-effort write — so a crash or an RPC
 * failure at any point re-processes safely instead of deleting an event that never applied.
 *
 * Leftover claimed rows from a previous session are folded back into the working set (NOT blindly
 * swept): with idempotency they are recoverable, so re-processing beats the old blind delete.
 *
 * Returns the number of events this drain resolved (applied or spent).
 */
export async function drainShare(
  getDocument: () => WorkspaceDocument | null,
  getCommittedDocument: () => WorkspaceDocument | null,
  dispatch: (intent: Intent) => void,
  flush: () => Promise<boolean>,
  share: { share_id: string; project_id: string; token: string },
): Promise<number> {
  const leftovers = await fetchLeftoverDrained(share.share_id).catch(() => [] as DrainRow[]);
  const claimed = await claimDrainableEvents(share.share_id, DRAINABLE_KINDS);
  // Leftovers (already drained=true) and freshly claimed rows are disjoint; dedupe by id defensively
  // and process in id order (the drain's FIFO).
  const working = [...new Map([...leftovers, ...claimed].map((e) => [e.id, e])).values()].sort(
    (a, b) => a.id - b.id,
  );
  if (working.length === 0) return 0;

  const doc = getDocument();
  if (!doc) return 0;

  // The ledger's live-id floor per resource = the smallest working-set id. Ids below it name events
  // already deleted from the table, so they can never be re-processed and are safe to evict (#850).
  const pruneBelow = new Map<string, number>();
  for (const e of working) {
    const key = `${e.node_id}:${e.res_index}`;
    const prev = pruneBelow.get(key);
    if (prev === undefined || e.id < prev) pruneBelow.set(key, e.id);
  }

  const plan = drainPlan(doc, share.project_id, share.token, working, nowIso(), pruneBelow);
  const plannedIds = new Set(plan.map((p) => p.eventId));

  // Resolve pseudonymous ids once for the committed-ledger membership tests (same lens the sanitizer
  // used). An event already in the COMMITTED ledger is durably applied: skip re-dispatching it (an
  // idempotent no-op that would still cost a version-bumping push) and delete it below.
  const idMap = guestIdMap(doc, share.project_id, share.token);
  const inCommittedLedger = (eventId: number, nodeId: string | undefined, index: number): boolean => {
    const committed = getCommittedDocument();
    if (!committed || !nodeId) return false;
    return committed.nodes[nodeId]?.drainLedger?.[index]?.includes(eventId) ?? false;
  };

  for (const p of plan) {
    if (inCommittedLedger(p.eventId, p.nodeId, p.index)) continue; // already landed — don't re-push
    dispatch(p.intent);
  }
  await flush();

  // Partition the working set against the now-committed ledger: applied (or junk) → delete; a still
  // un-applied dispatched event → leave claimed for the next drain.
  const deleteIds: number[] = [];
  for (const e of working) {
    if (!plannedIds.has(e.id)) {
      deleteIds.push(e.id); // no intent produced — structural junk, spent
      continue;
    }
    if (inCommittedLedger(e.id, idMap.get(e.node_id), e.res_index)) deleteIds.push(e.id);
  }
  if (deleteIds.length > 0) await deleteEvents(deleteIds).catch(() => {});
  return deleteIds.length;
}
