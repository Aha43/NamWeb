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
        ],
      }),
      secret: node('secret', { tags: ['private'] }),
    },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const pseudo = (doc: WorkspaceDocument, realId: string) => {
  for (const [p, r] of guestIdMap(doc, 'trip', SALT)) if (r === realId) return p;
  throw new Error(`no pseudo id for ${realId}`);
};

describe('drainPlan (#811) — the owner drain folds guest events into ordinary intents', () => {
  it('folds sequential ticks with a chained expectedValue, starting from the STORED string', () => {
    const doc = workspace();
    const a1 = pseudo(doc, 'a1');
    const events = [
      { id: 1, node_id: a1, res_index: 1, delta: 1 },
      { id: 2, node_id: a1, res_index: 1, delta: 1 },
      { id: 3, node_id: a1, res_index: 1, delta: -1 },
    ];
    const intents = drainPlan(doc, 'trip', SALT, events, 'T');
    expect(intents.map((i) => (i.type === 'incrementCountResource' ? i.expectedValue : ''))).toEqual([
      '10/12', '11/12', '12/12',
    ]);
    // And the chain actually applies: run it through the real reducer.
    let next = doc;
    for (const intent of intents) next = applyIntent(next, intent);
    expect(next.nodes['a1'].resources[1].value).toBe('11/12');
  });

  it('applies the reducer edge rules: a limited counter stops at its target mid-queue', () => {
    const doc = workspace();
    const a1 = pseudo(doc, 'a1');
    const events = [1, 2, 3, 4].map((id) => ({ id, node_id: a1, res_index: 1, delta: 1 }));
    const intents = drainPlan(doc, 'trip', SALT, events, 'T');
    expect(intents).toHaveLength(2); // 10 → 11 → 12, the last two ticks fold to nothing
    let next = doc;
    for (const intent of intents) next = applyIntent(next, intent);
    expect(next.nodes['a1'].resources[1].value).toBe('12/12');
  });

  it('drops untrusted hints: unknown ids, private subtrees, wrong types, undelegated counters, bad deltas', () => {
    const doc = workspace();
    const a1 = pseudo(doc, 'a1');
    // The private node's WOULD-BE pseudo id (computed from a doc where it isn't private):
    // in the real doc it's pruned from the map, so an event addressing it must drop.
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

  it('an unlimited counter keeps counting past the goal through the fold', () => {
    const doc = workspace();
    doc.nodes['a1'].resources[1] = { type: 'COUNT', value: '11/12+', description: 'jars', guestEditable: true };
    const a1 = pseudo(doc, 'a1');
    const events = [1, 2, 3].map((id) => ({ id, node_id: a1, res_index: 1, delta: 1 }));
    const intents = drainPlan(doc, 'trip', SALT, events, 'T');
    expect(intents).toHaveLength(3);
    let next = doc;
    for (const intent of intents) next = applyIntent(next, intent);
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
