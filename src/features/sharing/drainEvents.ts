// The owner drain's pure core (#811): fold a share's claimed guest events into the ordinary
// incrementCountResource intents the workspace already speaks — the single-writer model
// survives because only the owner's client ever writes the document; guests fed a queue.
//
// node_id/res_index arrive as UNTRUSTED HINTS: unknown pseudonymous ids, shifted indexes,
// and non-COUNT targets are tolerated drops (the same no-op family as the intent itself).
// The fold applies the reducer's own edge rules so a queue of ticks lands exactly as the
// owner's own taps would — including the running expectedValue chain, which starts from the
// STORED value verbatim (#802/F3: never reconstruct the first guard).

import type { Intent } from '@/domain/mutations';
import type { WorkspaceDocument } from '@/domain/types';
import { formatCount, parseCount } from '@/domain/resourceCount';
import { guestIdMap } from '@/domain/shareContent';

export interface DrainableEvent {
  id: number;
  node_id: string;
  res_index: number;
  delta: number;
}

/** The intents a batch of claimed events folds into, in arrival order. Pure. */
export function drainPlan(
  doc: WorkspaceDocument,
  projectId: string,
  salt: string,
  events: DrainableEvent[],
  now: string,
): Intent[] {
  const map = guestIdMap(doc, projectId, salt);
  const intents: Intent[] = [];
  // The running value per (node, index): the first intent guards on the stored string,
  // every later one on the value its predecessor will have produced.
  const running = new Map<string, string>();
  for (const event of events) {
    if (event.delta !== 1 && event.delta !== -1) continue;
    const nodeId = map.get(event.node_id);
    if (!nodeId) continue;
    const resource = doc.nodes[nodeId]?.resources[event.res_index];
    if (!resource || resource.type !== 'COUNT' || !resource.guestEditable) continue;
    const key = `${nodeId}:${event.res_index}`;
    const value = running.get(key) ?? resource.value;
    const count = parseCount(value);
    if (!count) continue;
    // The reducer's own edge rules — a tick that would no-op emits no intent.
    if (event.delta > 0 && !count.unlimited && count.current >= count.target) continue;
    if (event.delta < 0 && count.current <= 0) continue;
    intents.push({
      type: 'incrementCountResource',
      id: nodeId,
      index: event.res_index,
      expectedValue: value,
      delta: event.delta,
      now,
    });
    running.set(key, formatCount(count.current + event.delta, count.target, count.unlimited));
  }
  return intents;
}
