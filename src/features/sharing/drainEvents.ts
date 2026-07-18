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
import { formatQuestion, parseQuestion } from '@/domain/resourceQuestion';
import { guestIdMap } from '@/domain/shareContent';

export interface DrainableEvent {
  id: number;
  node_id: string;
  res_index: number;
  /** A counter tick carries delta; a question answer carries answer — exactly one. */
  delta: number | null;
  answer?: 'yes' | 'no' | 'clear' | null;
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
    const nodeId = map.get(event.node_id);
    if (!nodeId) continue;
    // Question answers (#827): a SET, chained on the running value like the counter chain.
    if (event.answer) {
      const resource = doc.nodes[nodeId]?.resources[event.res_index];
      if (!resource || resource.type !== 'QUESTION' || !resource.guestEditable) continue;
      const key = `q:${nodeId}:${event.res_index}`;
      const value = running.get(key) ?? resource.value;
      const q = parseQuestion(value);
      if (!q) continue;
      intents.push({
        type: 'answerQuestionResource',
        id: nodeId,
        index: event.res_index,
        expectedValue: value,
        answer: event.answer,
        now,
      });
      running.set(key, formatQuestion(event.answer === 'clear' ? null : event.answer));
      continue;
    }
    if (event.delta !== 1 && event.delta !== -1) continue;
    const resource = doc.nodes[nodeId]?.resources[event.res_index];
    if (!resource || resource.type !== 'COUNT' || !resource.guestEditable) continue;
    // Accepted residue (#821/F5): if the owner REORDERS resources while the queue is open,
    // an event can land on a SIBLING delegated counter of the same node (milk ticks on
    // eggs) — inside the delegated set, so the trust boundary holds; the data lands wrong.
    // Needs same-node multiple delegated counters + a mid-queue reorder. True addressing
    // needs resource ids — the same doc-format change #802/F4 declined.

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
