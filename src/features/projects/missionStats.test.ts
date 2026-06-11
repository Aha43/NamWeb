import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { missionStats } from './missionStats';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'NEXT', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

// root project P with two sub-projects:
//   A: actions a1(DONE), a2(NEXT)            → 1/2
//   B: sub-project B1 with b1(DONE)          → 1/1, 1 sub-project
function doc(): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {};
  for (const n of [
    node('P', { project: true, childIds: ['A', 'B'] }),
    node('A', { project: true, childIds: ['a1', 'a2'] }),
    node('a1', { status: 'DONE' }),
    node('a2', { status: 'NEXT' }),
    node('B', { project: true, childIds: ['B1'] }),
    node('B1', { project: true, childIds: ['b1'] }),
    node('b1', { status: 'DONE' }),
  ]) nodes[n.id] = n;
  return {
    formatVersion: 1, rootNodeId: 'r', inboxNodeId: 'i', projectsNodeId: 'pj', nextActionsNodeId: 'ac',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

describe('missionStats', () => {
  it('rolls up done/total actions and sub-project counts per direct sub-project', () => {
    const stats = missionStats(doc(), 'P');
    expect(stats).toEqual([
      { id: 'A', title: 'A', subProjectCount: 0, done: 1, total: 2, ratio: 0.5 },
      { id: 'B', title: 'B', subProjectCount: 1, done: 1, total: 1, ratio: 1 },
    ]);
  });
});
