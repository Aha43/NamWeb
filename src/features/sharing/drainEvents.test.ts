import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { applyIntent } from '@/domain/mutations';
import { guestIdMap } from '@/domain/shareContent';
import { drainPlan } from './drainEvents';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

const SALT = 'tok123';

function workspace(): WorkspaceDocument {
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: {
      root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
      inbox: node('inbox'),
      projects: node('projects', { childIds: ['trip'] }),
      actions: node('actions'),
      trip: node('trip', { project: true, childIds: ['a1', 'secret'] }),
      a1: node('a1', {
        title: 'Keep jars stocked',
        resources: [
          { type: 'TEXT', value: 'note', description: null },
          { type: 'COUNT', value: '10/12', description: 'jars', guestEditable: true },
          { type: 'COUNT', value: '1/5', description: 'undelegated' },
          { type: 'QUESTION', value: '?', description: 'Bringing a tent?', guestEditable: true },
        ],
      }),
      secret: node('secret', { tags: ['#shared-hide'] }),
    },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const pseudo = (doc: WorkspaceDocument, realId: string) => {
  for (const [p, r] of guestIdMap(doc, 'trip', SALT)) if (r === realId) return p;
  throw new Error(`no pseudo id for ${realId}`);
};

describe('drainPlan (#811/#850) — the owner drain folds guest events into idempotent intents', () => {
  it('emits ONE intent per event carrying its event id + delta, no expectedValue chain', () => {
    const doc = workspace();
    const a1 = pseudo(doc, 'a1');
    const events = [
      { id: 1, node_id: a1, res_index: 1, delta: 1 },
      { id: 2, node_id: a1, res_index: 1, delta: 1 },
      { id: 3, node_id: a1, res_index: 1, delta: -1 },
    ];
    const plan = drainPlan(doc, 'trip', SALT, events, 'T');
    // No stale-guard chain — each intent identifies its event by id and lets the reducer clamp.
    expect(plan.map((p) => p.eventId)).toEqual([1, 2, 3]);
    expect(plan.map((p) => (p.intent.type === 'incrementCountResource' ? p.intent.delta : 0))).toEqual([1, 1, -1]);
    expect(plan.every((p) => p.intent.type === 'incrementCountResource' && p.intent.expectedValue === undefined)).toBe(true);
    expect(plan.every((p) => p.intent.type === 'incrementCountResource' && p.intent.eventId === p.eventId)).toBe(true);
    // The chain actually applies in id order through the real reducer: 10 → 11 → 12 → 11.
    let next = doc;
    for (const p of plan) next = applyIntent(next, p.intent);
    expect(next.nodes['a1'].resources[1].value).toBe('11/12');
  });

  it('does NOT pre-drop at-target ticks — it emits them and the reducer CLAMPS (idempotency)', () => {
    const doc = workspace();
    const a1 = pseudo(doc, 'a1');
    const events = [1, 2, 3, 4].map((id) => ({ id, node_id: a1, res_index: 1, delta: 1 }));
    const plan = drainPlan(doc, 'trip', SALT, events, 'T');
    expect(plan).toHaveLength(4); // every event is planned; the reducer, not the plan, stops at target
    let next = doc;
    for (const p of plan) next = applyIntent(next, p.intent);
    expect(next.nodes['a1'].resources[1].value).toBe('12/12');
    // The watermark advances to the highest id so none is ever re-driven — even the two that clamped.
    expect(next.nodes['a1'].drainedThrough?.[1]).toBe(4);
  });

  it('drops untrusted hints: unknown ids, private subtrees, wrong types, undelegated counters, bad deltas', () => {
    const doc = workspace();
    const a1 = pseudo(doc, 'a1');
    const secret = pseudo({ ...doc, nodes: { ...doc.nodes, secret: node('secret') } }, 'secret');
    const events = [
      { id: 1, node_id: 'ffffffff', res_index: 1, delta: 1 }, // unknown pseudo id
      { id: 2, node_id: secret, res_index: 1, delta: 1 }, // private subtree: not in the map
      { id: 3, node_id: a1, res_index: 0, delta: 1 }, // TEXT, not COUNT
      { id: 4, node_id: a1, res_index: 2, delta: 1 }, // a counter, but NOT delegated
      { id: 5, node_id: a1, res_index: 9, delta: 1 }, // shifted index
      { id: 6, node_id: a1, res_index: 1, delta: 5 }, // illegal move
    ];
    expect(drainPlan(doc, 'trip', SALT, events, 'T')).toEqual([]);
  });

  it('folds question answers into per-event answerQuestionResource intents (#827)', () => {
    const doc = workspace();
    const a1 = pseudo(doc, 'a1');
    const events = [
      { id: 1, node_id: a1, res_index: 3, delta: null, answer: 'yes' as const },
      { id: 2, node_id: a1, res_index: 3, delta: null, answer: 'clear' as const }, // undo
      { id: 3, node_id: a1, res_index: 3, delta: null, answer: 'no' as const },
    ];
    const plan = drainPlan(doc, 'trip', SALT, events, 'T');
    expect(plan.map((p) => (p.intent.type === 'answerQuestionResource' ? p.intent.answer : ''))).toEqual([
      'yes', 'clear', 'no',
    ]);
    expect(plan.every((p) => p.intent.type === 'answerQuestionResource' && p.intent.expectedValue === undefined)).toBe(true);
    let next = doc;
    for (const p of plan) next = applyIntent(next, p.intent);
    expect(next.nodes['a1'].resources[3].value).toBe('no');
  });

  it('drops an answer on an undelegated or wrong-type resource (#827)', () => {
    const doc = workspace();
    const a1 = pseudo(doc, 'a1');
    const events = [
      { id: 1, node_id: a1, res_index: 0, delta: null, answer: 'yes' as const }, // TEXT
      { id: 2, node_id: a1, res_index: 1, delta: null, answer: 'yes' as const }, // COUNT, not QUESTION
    ];
    expect(drainPlan(doc, 'trip', SALT, events, 'T')).toEqual([]);
  });

  it('an unlimited counter keeps counting past the goal through the fold', () => {
    const doc = workspace();
    doc.nodes['a1'].resources[1] = { type: 'COUNT', value: '11/12+', description: 'jars', guestEditable: true };
    const a1 = pseudo(doc, 'a1');
    const events = [1, 2, 3].map((id) => ({ id, node_id: a1, res_index: 1, delta: 1 }));
    const plan = drainPlan(doc, 'trip', SALT, events, 'T');
    expect(plan).toHaveLength(3);
    let next = doc;
    for (const p of plan) next = applyIntent(next, p.intent);
    expect(next.nodes['a1'].resources[1].value).toBe('14/12+');
  });
});

describe('guestIdMap (#811)', () => {
  it('covers the sanitizer traversal exactly: root + included subtree, excluded pruned', () => {
    const doc = workspace();
    const map = guestIdMap(doc, 'trip', SALT);
    expect(new Set(map.values())).toEqual(new Set(['trip', 'a1'])); // secret (private) is out
    // Salt-dependent: another salt shares no keys.
    const other = guestIdMap(doc, 'trip', 'other-token');
    for (const key of other.keys()) expect(map.has(key)).toBe(false);
  });
});
