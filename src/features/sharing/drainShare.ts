import type { Intent } from '@/domain/mutations';
import type { WorkspaceDocument } from '@/domain/types';
import { nowIso } from '@/lib/local';
import { claimEvents, deleteEvents, fetchLeftoverDrained, fetchUndrainedEvents } from './shares';
import { drainPlan } from './drainEvents';

/**
 * Drain one share's guest events into the workspace (#811). Claim-then-apply: the atomic
 * claim means a concurrent drain on another device splits the batch instead of
 * double-counting. The document is read through a GETTER, resolved AFTER the claim
 * (#821/F2). Deletion waits for DURABLE success (#823/P1): `flush` resolves once every
 * dispatched write confirmed at the backend — on failure the rows stay drained and the
 * ticks live on in the optimistic doc (the sticky sync error + Retry own recovery).
 *
 * Leftover drained rows from a PREVIOUS session are swept first (#823/P2): a boolean claim
 * cannot distinguish "applied durably, delete failed" (re-applying would double-count) from
 * "claimed, crashed before durable" (the loss already happened) — either way the rows carry
 * no recoverable value, and keeping them inflates the lifetime cap toward a deaf share.
 *
 * Returns the number of events this drain landed.
 */
export async function drainShare(
  getDocument: () => WorkspaceDocument | null,
  dispatch: (intent: Intent) => void,
  flush: () => Promise<boolean>,
  share: { share_id: string; project_id: string; token: string },
): Promise<number> {
  await fetchLeftoverDrained(share.share_id)
    .then((ids) => (ids.length > 0 ? deleteEvents(ids) : undefined))
    .catch(() => {});
  const events = await fetchUndrainedEvents(share.share_id);
  if (events.length === 0) return 0;
  const won = new Set(await claimEvents(events.map((e) => e.id)));
  const mine = events.filter((e) => won.has(e.id));
  const doc = getDocument();
  if (mine.length === 0 || !doc) return 0;
  for (const intent of drainPlan(doc, share.project_id, share.token, mine, nowIso())) dispatch(intent);
  if (await flush()) {
    await deleteEvents(mine.map((e) => e.id)).catch(() => {});
  }
  return mine.length;
}
