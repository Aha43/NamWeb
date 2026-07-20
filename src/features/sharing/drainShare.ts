import type { Intent } from '@/domain/mutations';
import type { WorkspaceDocument } from '@/domain/types';
import { nowIso } from '@/lib/local';
import { guestIdMap } from '@/domain/shareContent';
import { DRAINABLE_KINDS, claimDrainableEvents, deleteEvents, fetchLeftoverDrained, type DrainRow } from './shares';
import { drainPlan } from './drainEvents';

/**
 * Drain one share's guest events into the workspace (#811, redesigned #850). Claim-then-apply: the
 * atomic claim splits the batch across concurrent devices.
 *
 * Idempotency is a per-resource APPEND-ONLY set (`drainLedger`): the reducer applies an event only if
 * its id is not already recorded, then records it. Membership is order-independent, so two devices
 * that apply their events out of order (a later event committing before an earlier one), a re-fetched
 * leftover, or a conflict-replay are all safe no-ops — and nothing is ever removed, so there is no
 * eviction/tombstone race to re-apply a landed event. (The trade-off is unbounded growth; safe bounded
 * compaction needs a server-side drain lease — tracked as #852. Fine while sharing is Labs-dark.)
 *
 * Everything keys off the COMMITTED (server-confirmed) document, never the optimistic snapshot: an
 * unconfirmed local edit — e.g. a failed removal of a delegated resource — must not make a valid
 * event look like junk and get deleted. So we plan against the committed doc, dispatch, `await
 * flush()`, then decide each event against the *now*-committed doc:
 *   - id in the committed ledger → DURABLY APPLIED → delete.
 *   - yields no intent against the committed doc → structural junk → delete.
 *   - otherwise (applicable but not landed — a failed/pending write) → LEAVE CLAIMED for the next drain.
 *
 * Returns the number of events this drain resolved (applied or spent).
 */
export async function drainShare(
  getCommittedDocument: () => WorkspaceDocument | null,
  dispatch: (intent: Intent) => void,
  flush: () => Promise<boolean>,
  share: { share_id: string; project_id: string; token: string },
): Promise<number> {
  let leftovers: DrainRow[];
  try {
    leftovers = await fetchLeftoverDrained(share.share_id);
  } catch {
    leftovers = []; // a hiccup: this drain just processes the freshly-claimed rows, leftovers next time
  }
  const claimed = await claimDrainableEvents(share.share_id, DRAINABLE_KINDS);
  // Leftovers (already drained=true) and freshly claimed rows are disjoint; dedupe by id defensively
  // and process in id order (a coherent per-resource sequence; the set idempotency needs no ordering,
  // but a −1 then +1 must still land in that order).
  const working = [...new Map([...leftovers, ...claimed].map((e) => [e.id, e])).values()].sort(
    (a, b) => a.id - b.id,
  );
  if (working.length === 0) return 0;

  const before = getCommittedDocument();
  if (!before) return 0; // no committed truth to plan against — retried on the next trigger

  const applied = (doc: WorkspaceDocument | null, eventId: number, nodeId: string | undefined, index: number): boolean =>
    !!doc && !!nodeId && (doc.nodes[nodeId]?.drainLedger?.[index]?.includes(eventId) ?? false);

  // Dispatch each planned intent in id order, skipping any already recorded in the committed ledger
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
