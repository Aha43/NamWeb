import type { Intent } from '@/domain/mutations';
import type { WorkspaceDocument } from '@/domain/types';
import { nowIso } from '@/lib/local';
import { claimEvents, fetchUndrainedEvents } from './shares';
import { drainPlan } from './drainEvents';

/**
 * Drain one share's guest events into the workspace (#811). Claim-then-apply: the atomic
 * claim means a concurrent drain on another device splits the batch instead of
 * double-counting; the local dispatches after a won claim are synchronous, so the crash
 * window is effectively the claim round-trip itself. Failures leave events unclaimed —
 * the next drain retries them.
 */
export async function drainShare(
  doc: WorkspaceDocument,
  dispatch: (intent: Intent) => void,
  share: { share_id: string; project_id: string; token: string },
): Promise<void> {
  const events = await fetchUndrainedEvents(share.share_id);
  if (events.length === 0) return;
  const won = new Set(await claimEvents(events.map((e) => e.id)));
  const mine = events.filter((e) => won.has(e.id));
  if (mine.length === 0) return;
  for (const intent of drainPlan(doc, share.project_id, share.token, mine, nowIso())) dispatch(intent);
}
