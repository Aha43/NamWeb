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
 * Everything keys off the COMMITTED (server-confirmed) document, never the optimistic snapshot
 * (#850 review): an unconfirmed local edit — e.g. a failed removal of a delegated resource — must
 * not make a still-valid guest event look like junk and get deleted. So we plan against the
 * committed doc, dispatch, `await flush()`, then decide each event's fate against the *now*-committed
 * doc:
 *   - id in the committed `drainLedger` → DURABLY APPLIED → delete.
 *   - yields no intent against the committed doc → structural junk (unresolved id, wrong type,
 *     un-delegated) → delete.
 *   - otherwise (applicable but not landed — a failed/pending write) → LEAVE CLAIMED; the next drain
 *     re-processes it, idempotently.
 * The ledger makes re-processing a no-op, so a crash / RPC failure / second device is safe.
 *
 * Ledger GC is a TOMBSTONE step (#850 review): after a successful delete we dispatch `pruneDrainLedger`
 * to forget exactly the ids whose rows we just removed. A tab never forgets an id it didn't delete —
 * the only race-safe bound, since another tab may hold an undeleted-but-applied row with a smaller id.
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
  // and process in id order (the drain's FIFO the ledger's −1,+1 correctness relies on).
  const working = [...new Map([...leftovers, ...claimed].map((e) => [e.id, e])).values()].sort(
    (a, b) => a.id - b.id,
  );
  if (working.length === 0) return 0;

  const before = getCommittedDocument();
  if (!before) return 0; // no committed truth to plan against — retried on the next trigger

  const inLedger = (doc: WorkspaceDocument | null, eventId: number, nodeId: string | undefined, index: number): boolean =>
    !!doc && !!nodeId && (doc.nodes[nodeId]?.drainLedger?.[index]?.includes(eventId) ?? false);

  // Dispatch each planned intent in id order, skipping any already durably applied (an idempotent
  // no-op that would still cost a version-bumping push).
  const plan = drainPlan(before, share.project_id, share.token, working, nowIso());
  for (const p of plan) {
    if (!inLedger(before, p.eventId, p.nodeId, p.index)) dispatch(p.intent);
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
    const applied = inLedger(after, e.id, afterMap.get(e.node_id), e.res_index);
    const junk = !plannableAfter.has(e.id); // yields no intent against the committed doc
    if (applied || junk) deleteIds.push(e.id);
    // else: applicable but not yet landed (a failed/pending write) — leave claimed
  }
  if (deleteIds.length === 0) return 0;

  const deleted = await deleteEvents(deleteIds).then(() => true).catch(() => false);
  if (!deleted) return 0; // rows still there; next drain re-processes idempotently

  // Tombstone GC: forget the just-deleted ids from their resources' ledgers (race-safe — only ids
  // whose rows we durably removed). Only APPLIED ids are in a ledger; junk was never recorded, so we
  // skip it (no wasted no-op prune).
  const deleteSet = new Set(deleteIds);
  const byResource = new Map<string, { id: string; index: number; eventIds: number[] }>();
  for (const e of working) {
    if (!deleteSet.has(e.id)) continue;
    const nodeId = afterMap.get(e.node_id);
    if (!inLedger(after, e.id, nodeId, e.res_index)) continue; // junk — never in a ledger
    const key = `${nodeId}:${e.res_index}`;
    const entry = byResource.get(key) ?? { id: nodeId!, index: e.res_index, eventIds: [] };
    entry.eventIds.push(e.id);
    byResource.set(key, entry);
  }
  if (byResource.size > 0) dispatch({ type: 'pruneDrainLedger', entries: [...byResource.values()] });
  return deleteIds.length;
}
