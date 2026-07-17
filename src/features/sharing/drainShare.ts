import type { Intent } from '@/domain/mutations';
import type { WorkspaceDocument } from '@/domain/types';
import { nowIso } from '@/lib/local';
import { claimEvents, deleteEvents, fetchUndrainedEvents } from './shares';
import { drainPlan } from './drainEvents';

/**
 * Drain one share's guest events into the workspace (#811). Claim-then-apply: the atomic
 * claim means a concurrent drain on another device splits the batch instead of
 * double-counting. The document is read through a GETTER, resolved AFTER the claim
 * (#821/F2): planning against a doc captured before the two network round-trips let a sync
 * refetch strand claimed ticks (drained but every intent no-oping on stale expectedValues).
 * Applied events are then DELETED (#821): drained rows served nothing and ratcheted the
 * lifetime cap toward a permanently deaf share. Failures before the claim leave events
 * unclaimed — the next drain retries them.
 *
 * Returns the number of events this drain landed.
 */
export async function drainShare(
  getDocument: () => WorkspaceDocument | null,
  dispatch: (intent: Intent) => void,
  share: { share_id: string; project_id: string; token: string },
): Promise<number> {
  const events = await fetchUndrainedEvents(share.share_id);
  if (events.length === 0) return 0;
  const won = new Set(await claimEvents(events.map((e) => e.id)));
  const mine = events.filter((e) => won.has(e.id));
  const doc = getDocument();
  if (mine.length === 0 || !doc) return 0;
  for (const intent of drainPlan(doc, share.project_id, share.token, mine, nowIso())) dispatch(intent);
  // Tidy after landing — a failed delete only leaves inert drained rows behind.
  await deleteEvents(mine.map((e) => e.id)).catch(() => {});
  return mine.length;
}
