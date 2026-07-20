// The owner-drain idempotency WATERMARK (#832/#850): applyIntent in LEDGER MODE (intents carrying an
// `eventId`) applies each guest event at most once — an id at or below the resource's `drainedThrough`
// no-ops, and applying advances the watermark. Because it only ever rises it is immune to the re-apply
// an evictable ledger suffered. PILL MODE (no `eventId`) must stay exactly as it was.

import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { applyIntent } from './mutations';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function doc(node0: NamNode): WorkspaceDocument {
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: { root: node('root'), inbox: node('inbox'), projects: node('projects'), actions: node('actions'), a1: node0 },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const count = (value: string, extra: Partial<NamNode> = {}) =>
  doc(node('a1', { resources: [{ type: 'COUNT', value, description: 'jars', guestEditable: true }], ...extra }));
const question = (value: string) =>
  doc(node('a1', { resources: [{ type: 'QUESTION', value, description: 'Tent?', guestEditable: true }] }));

const tick = (index: number, delta: 1 | -1, eventId: number) =>
  ({ type: 'incrementCountResource' as const, id: 'a1', index, delta, eventId, now: 'T' });
const answer = (index: number, a: 'yes' | 'no' | 'clear', eventId: number) =>
  ({ type: 'answerQuestionResource' as const, id: 'a1', index, answer: a, eventId, now: 'T' });

describe('drain watermark idempotency (#850) — counters', () => {
  it('applies a new (above-watermark) event and advances the watermark', () => {
    const next = applyIntent(count('10/12'), tick(0, 1, 7));
    expect(next.nodes['a1'].resources[0].value).toBe('11/12');
    expect(next.nodes['a1'].drainedThrough?.[0]).toBe(7);
  });

  it('skips an id at or below the watermark — value and watermark unchanged (no double-count)', () => {
    const applied = applyIntent(count('10/12'), tick(0, 1, 7)); // → 11/12, watermark 7
    const sameId = applyIntent(applied, tick(0, 1, 7)); // the SAME event, re-processed
    expect(sameId.nodes['a1'].resources[0].value).toBe('11/12');
    const lowerId = applyIntent(applied, tick(0, 1, 5)); // an older id — already covered
    expect(lowerId.nodes['a1'].resources[0].value).toBe('11/12');
    expect(lowerId.nodes['a1'].drainedThrough?.[0]).toBe(7);
  });

  it('ABA-immune: a re-apply after the watermark passed the id is still a no-op (Codex P1)', () => {
    // A leftover re-processed by a second tab AFTER the first advanced the watermark: the watermark
    // never went backward, so the id is at/below it → skip. An evictable ledger would re-apply here.
    let d = applyIntent(count('0/12'), tick(0, 1, 7)); // watermark 7, value 1/12
    d = applyIntent(d, tick(0, 1, 7)); // the second tab's delayed replay of event 7
    expect(d.nodes['a1'].resources[0].value).toBe('1/12'); // NOT 2/12
  });

  it('records a delta that CLAMPS to nothing so it terminates (−1 at zero stays 0, watermark rises)', () => {
    const next = applyIntent(count('0/12'), tick(0, -1, 5));
    expect(next.nodes['a1'].resources[0].value).toBe('0/12');
    expect(next.nodes['a1'].drainedThrough?.[0]).toBe(5);
  });

  it('the blocker-1 sequence: −1 then +1 on a zero counter lands 1 (id-ordered, clamp-then-apply)', () => {
    let next = count('0/12');
    next = applyIntent(next, tick(0, -1, 1)); // clamps at 0, watermark 1
    next = applyIntent(next, tick(0, 1, 2)); // 0 → 1, watermark 2
    expect(next.nodes['a1'].resources[0].value).toBe('1/12');
    expect(next.nodes['a1'].drainedThrough?.[0]).toBe(2);
  });

  it('clamps an at-target +1 and advances, without re-completing an already-met action', () => {
    const base = count('12/12', { status: 'DONE', resources: [{ type: 'COUNT', value: '12/12', description: 'j', guestEditable: true, completesAction: true }] });
    const next = applyIntent(base, tick(0, 1, 9));
    expect(next.nodes['a1'].resources[0].value).toBe('12/12');
    expect(next.nodes['a1'].status).toBe('DONE'); // stayed met → no crossing
    expect(next.nodes['a1'].drainedThrough?.[0]).toBe(9);
  });

  it('completesAction crossing still fires in ledger mode: a tick reaching the goal marks DONE', () => {
    const base = count('11/12', { resources: [{ type: 'COUNT', value: '11/12', description: 'j', guestEditable: true, completesAction: true }] });
    const next = applyIntent(base, tick(0, 1, 4));
    expect(next.nodes['a1'].resources[0].value).toBe('12/12');
    expect(next.nodes['a1'].status).toBe('DONE');
  });

  it('watermarks are per resource index — a high id on one does not gate another', () => {
    const base = doc(node('a1', { resources: [
      { type: 'COUNT', value: '0/9', description: 'a', guestEditable: true },
      { type: 'COUNT', value: '0/9', description: 'b', guestEditable: true },
    ] }));
    let next = applyIntent(base, tick(0, 1, 50)); // index 0 → watermark 50
    next = applyIntent(next, tick(1, 1, 7)); // index 1 → applies (its own watermark is 0)
    expect(next.nodes['a1'].resources[1].value).toBe('1/9');
    expect(next.nodes['a1'].drainedThrough).toEqual({ 0: 50, 1: 7 });
  });

  it('no-ops on a missing node or wrong resource type', () => {
    const wrongType = doc(node('a1', { resources: [{ type: 'TEXT', value: 'x', description: null }] }));
    expect(applyIntent(wrongType, tick(0, 1, 7))).toEqual(wrongType);
  });
});

describe('drain watermark idempotency (#850) — questions', () => {
  it('SETs a new answer and advances the watermark; a re-processed id is a no-op', () => {
    const applied = applyIntent(question('?'), answer(0, 'yes', 3));
    expect(applied.nodes['a1'].resources[0].value).toBe('yes');
    expect(applied.nodes['a1'].drainedThrough?.[0]).toBe(3);
    const again = applyIntent(applied, answer(0, 'no', 3)); // same id → ignored
    expect(again.nodes['a1'].resources[0].value).toBe('yes');
    expect(again.nodes['a1'].drainedThrough?.[0]).toBe(3);
  });
});

describe('pill mode is unchanged (#850) — no eventId, expectedValue guard, no watermark', () => {
  it('applies on a value match and never touches the watermark', () => {
    const next = applyIntent(count('10/12'), { type: 'incrementCountResource', id: 'a1', index: 0, expectedValue: '10/12', delta: 1, now: 'T' });
    expect(next.nodes['a1'].resources[0].value).toBe('11/12');
    expect(next.nodes['a1'].drainedThrough).toBeUndefined();
  });

  it('no-ops (stale guard) when the value has moved', () => {
    const next = applyIntent(count('11/12'), { type: 'incrementCountResource', id: 'a1', index: 0, expectedValue: '10/12', delta: 1, now: 'T' });
    expect(next.nodes['a1'].resources[0].value).toBe('11/12');
    expect(next.nodes['a1'].drainedThrough).toBeUndefined();
  });
});
