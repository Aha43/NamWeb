// The owner drain's pure core (#811, redesigned #850): fold a share's claimed guest events into
// the ordinary increment/answer intents the workspace already speaks — the single-writer model
// survives because only the owner's client ever writes the document; guests fed a queue.
//
// node_id/res_index arrive as UNTRUSTED HINTS: unknown pseudonymous ids, shifted indexes, and
// non-matching types are tolerated STRUCTURAL DROPS (the event yields no intent → drainShare
// deletes it). Everything else emits ONE intent carrying the event id — the reducer's idempotency
// ledger (#832/#850) makes the apply safe under re-processing, so there is no running-value chain
// and no at-target/at-zero pre-check here: the reducer clamps and records. Ordering (the FIFO the
// ledger relies on) is the drain's job, not this plan's — it is handed events already id-sorted.

import type { Intent } from '@/domain/mutations';
import type { WorkspaceDocument } from '@/domain/types';
import { parseCount } from '@/domain/resourceCount';
import { parseQuestion } from '@/domain/resourceQuestion';
import { guestIdMap } from '@/domain/shareContent';

export interface DrainableEvent {
  id: number;
  node_id: string;
  res_index: number;
  /** A counter tick carries delta; a question answer carries answer — exactly one. */
  delta: number | null;
  answer?: 'yes' | 'no' | 'clear' | null;
}

/** One planned drain intent plus the event id it came from (drainShare's delete/keep key) and the
 *  resolved (nodeId, index) it targets — so drainShare can read the ledger without narrowing Intent. */
export interface PlannedIntent {
  intent: Intent;
  eventId: number;
  nodeId: string;
  index: number;
}

/**
 * The intents a batch of claimed events folds into, in arrival (id) order. Pure. `pruneBelow` maps
 * `${node_id}:${res_index}` → the ledger's live-id floor for that resource (drainShare's min working
 * id); an event that yields no intent (structural drop) is simply absent from the result.
 */
export function drainPlan(
  doc: WorkspaceDocument,
  projectId: string,
  salt: string,
  events: DrainableEvent[],
  now: string,
  pruneBelow?: Map<string, number>,
): PlannedIntent[] {
  const map = guestIdMap(doc, projectId, salt);
  const planned: PlannedIntent[] = [];
  for (const event of events) {
    const nodeId = map.get(event.node_id);
    if (!nodeId) continue; // unresolved pseudonymous id — structural drop
    const resource = doc.nodes[nodeId]?.resources[event.res_index];
    if (!resource || !resource.guestEditable) continue;
    const floor = pruneBelow?.get(`${event.node_id}:${event.res_index}`);
    // Question answers (#827): a SET. The reducer skips it if already recorded, else applies.
    if (event.answer) {
      if (resource.type !== 'QUESTION' || !parseQuestion(resource.value)) continue;
      planned.push({
        eventId: event.id,
        nodeId,
        index: event.res_index,
        intent: {
          type: 'answerQuestionResource',
          id: nodeId,
          index: event.res_index,
          answer: event.answer,
          eventId: event.id,
          pruneBelow: floor,
          now,
        },
      });
      continue;
    }
    if (event.delta !== 1 && event.delta !== -1) continue;
    // Accepted residue (#821/F5): if the owner REORDERS resources while the queue is open, an event
    // can land on a SIBLING delegated counter of the same node (milk ticks on eggs) — inside the
    // delegated set, so the trust boundary holds; the data lands wrong. Dropping expectedValue on
    // this path (the ledger identifies by event id, not value) slightly widens this; true addressing
    // needs resource ids, the doc-format change #802/F4 declined.
    if (resource.type !== 'COUNT' || !parseCount(resource.value)) continue;
    planned.push({
      eventId: event.id,
      nodeId,
      index: event.res_index,
      intent: {
        type: 'incrementCountResource',
        id: nodeId,
        index: event.res_index,
        delta: event.delta,
        eventId: event.id,
        pruneBelow: floor,
        now,
      },
    });
  }
  return planned;
}
