import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { missionStats, heatBorderClass } from './missionStats';

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

  it('adds an "Unsorted" card for the parent\'s own direct actions (only when it has some)', () => {
    const d = doc();
    // Give P two direct actions of its own.
    d.nodes['P'].childIds = ['p1', 'p2', 'A', 'B'];
    d.nodes['p1'] = node('p1', { status: 'DONE' });
    d.nodes['p2'] = node('p2', { status: 'NEXT' });
    const stats = missionStats(d, 'P');
    expect(stats[0]).toEqual({ id: 'P', title: 'Unsorted', subProjectCount: 0, done: 1, total: 2, ratio: 0.5 });
    expect(stats.map((s) => s.id)).toEqual(['P', 'A', 'B']); // own box first, then sub-projects
  });

  it('omits the own-actions card when the project has no direct actions', () => {
    expect(missionStats(doc(), 'P').some((s) => s.id === 'P')).toBe(false);
  });
});

describe('heatBorderClass', () => {
  it('is neutral for an empty card, not green', () => {
    expect(heatBorderClass({ total: 0, ratio: 1 })).toBe('border-border');
  });

  it('colours by done-ratio when there are actions', () => {
    expect(heatBorderClass({ total: 3, ratio: 0 })).toContain('red');
    expect(heatBorderClass({ total: 3, ratio: 0.5 })).toContain('amber');
    expect(heatBorderClass({ total: 3, ratio: 1 })).toContain('green');
  });
});
