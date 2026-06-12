import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { missionControlStations } from './goalBoards';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'NEXT', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

// P[goal] / S[goal] (sub-project of P, also tagged) ; Q[goal] (separate). P has a1(DONE), a2(NEXT).
function doc(): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {};
  for (const n of [
    node('P', { project: true, tags: ['goal'], childIds: ['S', 'a1', 'a2'] }),
    node('S', { project: true, tags: ['goal'] }),
    node('a1', { status: 'DONE' }),
    node('a2', { status: 'NEXT' }),
    node('Q', { project: true, tags: ['goal'] }),
    node('R', { project: true, tags: ['other'] }),
  ]) nodes[n.id] = n;
  return {
    formatVersion: 1, rootNodeId: 'r', inboxNodeId: 'i', projectsNodeId: 'pj', nextActionsNodeId: 'ac',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

describe('missionControlStations', () => {
  it('returns tag-matched projects, de-duped to top-most, with roll-ups', () => {
    const stations = missionControlStations(doc(), { name: 'Goals', tags: ['goal'] });
    // S is dropped (its ancestor P also matches); R excluded (wrong tag)
    expect(stations.map((s) => s.id).sort()).toEqual(['P', 'Q']);
    const p = stations.find((s) => s.id === 'P')!;
    expect(p).toMatchObject({ done: 1, total: 2, subProjectCount: 1, ratio: 0.5 });
  });
});
