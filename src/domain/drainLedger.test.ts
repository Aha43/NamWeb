// The owner-drain idempotency ledger (#832/#850): applyIntent in LEDGER MODE (intents carrying an
// `eventId`) must apply each guest event exactly once — recording every id it sees (even when the
// delta clamps to nothing) so a re-processed leftover or a raced claim is a no-op, and PILL MODE
// (no `eventId`, the owner's own tap) must stay exactly as it was.

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

describe('drain ledger idempotency (#850) — counters', () => {
  it('applies a new event id and records it', () => {
    const next = applyIntent(count('10/12'), tick(0, 1, 7));
    expect(next.nodes['a1'].resources[0].value).toBe('11/12');
    expect(next.nodes['a1'].drainLedger?.[0]).toEqual([7]);
  });

  it('skips an already-recorded id — value and ledger unchanged (no double-count)', () => {
    const applied = applyIntent(count('10/12'), tick(0, 1, 7)); // → 11/12, ledger [7]
    const again = applyIntent(applied, tick(0, 1, 7)); // the SAME event, re-processed
    expect(again.nodes['a1'].resources[0].value).toBe('11/12');
    expect(again.nodes['a1'].drainLedger?.[0]).toEqual([7]);
  });

  it('records a delta that CLAMPS to nothing so it terminates (−1 at zero stays 0, ledger grows)', () => {
    const next = applyIntent(count('0/12'), tick(0, -1, 5));
    expect(next.nodes['a1'].resources[0].value).toBe('0/12');
    expect(next.nodes['a1'].drainLedger?.[0]).toEqual([5]);
  });

  it('the blocker-1 sequence: −1 then +1 on a zero counter lands 1 (id-ordered, clamp-then-apply)', () => {
    let next = count('0/12');
    next = applyIntent(next, tick(0, -1, 1)); // clamps at 0, records 1
    next = applyIntent(next, tick(0, 1, 2)); // 0 → 1, records 2
    expect(next.nodes['a1'].resources[0].value).toBe('1/12');
    expect(next.nodes['a1'].drainLedger?.[0]).toEqual([1, 2]);
  });

  it('clamps an at-target +1 and records it, without re-completing an already-met action', () => {
    const base = count('12/12', { status: 'DONE', resources: [{ type: 'COUNT', value: '12/12', description: 'j', guestEditable: true, completesAction: true }] });
    const next = applyIntent(base, tick(0, 1, 9));
    expect(next.nodes['a1'].resources[0].value).toBe('12/12');
    expect(next.nodes['a1'].status).toBe('DONE'); // stayed met → no crossing
    expect(next.nodes['a1'].drainLedger?.[0]).toEqual([9]);
  });

  it('completesAction crossing still fires in ledger mode: a tick reaching the goal marks DONE', () => {
    const base = count('11/12', { resources: [{ type: 'COUNT', value: '11/12', description: 'j', guestEditable: true, completesAction: true }] });
    const next = applyIntent(base, tick(0, 1, 4));
    expect(next.nodes['a1'].resources[0].value).toBe('12/12');
    expect(next.nodes['a1'].status).toBe('DONE');
  });

  it('no-ops on a missing node or wrong resource type', () => {
    const wrongType = doc(node('a1', { resources: [{ type: 'TEXT', value: 'x', description: null }] }));
    expect(applyIntent(wrongType, tick(0, 1, 7))).toEqual(wrongType);
  });
});

describe('pruneDrainLedger (#850) — delete-confirmed tombstone GC', () => {
  it('forgets exactly the given ids, keeping the rest', () => {
    const base = count('3/12');
    base.nodes['a1'].drainLedger = { 0: [1, 2, 3, 4] };
    const next = applyIntent(base, { type: 'pruneDrainLedger', entries: [{ id: 'a1', index: 0, eventIds: [1, 2] }] });
    expect(next.nodes['a1'].drainLedger?.[0]).toEqual([3, 4]);
  });

  it('clears the ledger back to ABSENT when its last id is forgotten (additive contract)', () => {
    const base = count('3/12');
    base.nodes['a1'].drainLedger = { 0: [7] };
    const next = applyIntent(base, { type: 'pruneDrainLedger', entries: [{ id: 'a1', index: 0, eventIds: [7] }] });
    expect(next.nodes['a1'].drainLedger).toBeUndefined();
  });

  it('is idempotent and tolerant: an already-forgotten id or a vanished node is a no-op', () => {
    const base = count('3/12');
    base.nodes['a1'].drainLedger = { 0: [7] };
    const once = applyIntent(base, { type: 'pruneDrainLedger', entries: [{ id: 'a1', index: 0, eventIds: [7] }] });
    const twice = applyIntent(once, { type: 'pruneDrainLedger', entries: [{ id: 'a1', index: 0, eventIds: [7] }] });
    expect(twice.nodes['a1'].drainLedger).toBeUndefined();
    // A vanished node just no-ops (replay against a doc where the node was deleted).
    expect(applyIntent(base, { type: 'pruneDrainLedger', entries: [{ id: 'gone', index: 0, eventIds: [1] }] })).toEqual(base);
  });
});

describe('drain ledger idempotency (#850) — questions', () => {
  it('SETs a new answer and records the id; re-processing the same id is a no-op', () => {
    const applied = applyIntent(question('?'), answer(0, 'yes', 3));
    expect(applied.nodes['a1'].resources[0].value).toBe('yes');
    expect(applied.nodes['a1'].drainLedger?.[0]).toEqual([3]);
    const again = applyIntent(applied, answer(0, 'no', 3)); // same id → ignored
    expect(again.nodes['a1'].resources[0].value).toBe('yes');
    expect(again.nodes['a1'].drainLedger?.[0]).toEqual([3]);
  });
});

describe('pill mode is unchanged (#850) — no eventId, expectedValue guard, no ledger', () => {
  it('applies on a value match and never touches the ledger', () => {
    const next = applyIntent(count('10/12'), { type: 'incrementCountResource', id: 'a1', index: 0, expectedValue: '10/12', delta: 1, now: 'T' });
    expect(next.nodes['a1'].resources[0].value).toBe('11/12');
    expect(next.nodes['a1'].drainLedger).toBeUndefined();
  });

  it('no-ops (stale guard) when the value has moved', () => {
    const next = applyIntent(count('11/12'), { type: 'incrementCountResource', id: 'a1', index: 0, expectedValue: '10/12', delta: 1, now: 'T' });
    expect(next.nodes['a1'].resources[0].value).toBe('11/12');
    expect(next.nodes['a1'].drainLedger).toBeUndefined();
  });
});
