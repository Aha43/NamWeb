import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { GONE_QUIET_DAYS, goneQuiet, stalledProjects } from './review';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'NEXT', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

/** `extra` nodes are added to the map; wire childIds yourself for structure. */
function workspace(extra: NamNode[]): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {
    root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    inbox: node('inbox'),
    projects: node('projects'),
    actions: node('actions'),
  };
  for (const n of extra) nodes[n.id] = n;
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const NOW = new Date('2026-07-23T12:00:00');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe('stalledProjects (#906)', () => {
  it('flags an open project whose subtree has no NEXT action', () => {
    const doc = workspace([
      node('p', { title: 'Reno', project: true, childIds: ['a'] }),
      node('a', { title: 'Pick tiles', status: 'BACKLOG' }), // only backlog → stalled
      node('q', { title: 'Trip', project: true, childIds: ['b'] }),
      node('b', { title: 'Book flights', status: 'NEXT' }), // has a next → not stalled
    ]);
    doc.nodes['projects'].childIds.push('p', 'q');
    expect(stalledProjects(doc).map((n) => n.title)).toEqual(['Reno']);
  });

  it('an empty project (no children) is stalled; a done/cancelled project is not listed', () => {
    const doc = workspace([
      node('empty', { title: 'Empty', project: true }),
      node('shipped', { title: 'Shipped', project: true, status: 'DONE', childIds: [] }),
    ]);
    doc.nodes['projects'].childIds.push('empty', 'shipped');
    expect(stalledProjects(doc).map((n) => n.title)).toEqual(['Empty']);
  });

  it('a container project is NOT stalled when a sub-project holds the next action', () => {
    const doc = workspace([
      node('parent', { title: 'Parent', project: true, childIds: ['sub'] }),
      node('sub', { title: 'Sub', project: true, childIds: ['a'] }),
      node('a', { title: 'Do', status: 'NEXT' }),
    ]);
    doc.nodes['projects'].childIds.push('parent');
    expect(stalledProjects(doc)).toEqual([]); // the next action lives deep in the subtree
  });

  it('excludes archived projects', () => {
    const doc = workspace([
      node('arch', { title: 'Archived', project: true, status: 'ARCHIVED', childIds: [] }),
    ]);
    doc.nodes['projects'].childIds.push('arch');
    expect(stalledProjects(doc)).toEqual([]);
  });

  it('hides #not-stalled-tagged projects by default; includeAcknowledged surfaces them (#909)', () => {
    const doc = workspace([
      node('sprint', { title: 'Sprint', project: true, tags: ['#not-stalled'], childIds: ['a'] }),
      node('a', { title: 'Draft handover', status: 'BACKLOG' }), // no next → would be stalled, but tagged
      node('reno', { title: 'Reno', project: true, childIds: ['b'] }),
      node('b', { title: 'Pick tiles', status: 'BACKLOG' }),
    ]);
    doc.nodes['projects'].childIds.push('sprint', 'reno');
    expect(stalledProjects(doc).map((n) => n.title)).toEqual(['Reno']); // Sprint intentionally hidden
    expect(stalledProjects(doc, true).map((n) => n.title)).toEqual(['Sprint', 'Reno']); // both, in DFS order
  });

  it('a project whose only NEXT action is blocked is stalled — nothing actionable (#915)', () => {
    const doc = workspace([
      node('p', { title: 'Waiting', project: true, childIds: ['a', 'b'] }),
      node('a', { title: 'Do it', status: 'NEXT', blockedBy: ['b'] }), // NEXT but blocked
      node('b', { title: 'Prereq', status: 'BACKLOG' }), // unfinished prerequisite
    ]);
    doc.nodes['projects'].childIds.push('p');
    expect(stalledProjects(doc).map((n) => n.title)).toEqual(['Waiting']);

    // Unblock it (prereq done) → the project has an actionable next → no longer stalled.
    doc.nodes['b'].status = 'DONE';
    expect(stalledProjects(doc)).toEqual([]);
  });

  it('orders by DFS of the project tree, nesting a stalled sub-project under its parent (#909)', () => {
    const doc = workspace([
      node('alpha', { title: 'Alpha', project: true, childIds: [] }), // stalled top-level (empty)
      node('healthy', { title: 'Healthy', project: true, childIds: ['h1', 'sub'] }),
      node('h1', { title: 'Do it', status: 'NEXT' }), // parent has a next → not stalled itself
      node('sub', { title: 'Sub', project: true, childIds: ['s1'] }), // stalled sub-project
      node('s1', { title: 'Later', status: 'BACKLOG' }),
    ]);
    doc.nodes['projects'].childIds.push('alpha', 'healthy');
    // DFS: Alpha (top), then descend into Healthy → its stalled Sub. Healthy itself is not listed.
    expect(stalledProjects(doc).map((n) => n.title)).toEqual(['Alpha', 'Sub']);
  });
});

describe('goneQuiet (#906)', () => {
  it('flags open actions untouched for the threshold, by latest timestamp; recent ones stay silent', () => {
    const doc = workspace([
      node('old', { title: 'Old', status: 'NEXT', updatedAt: daysAgo(GONE_QUIET_DAYS + 1) }),
      node('fresh', { title: 'Fresh', status: 'NEXT', updatedAt: daysAgo(2) }),
      // createdAt long ago but updatedAt recent → the latest timestamp wins → not quiet.
      node('touched', { title: 'Touched', status: 'BACKLOG', createdAt: daysAgo(90), updatedAt: daysAgo(1) }),
    ]);
    doc.nodes['actions'].childIds.push('old', 'fresh', 'touched');
    expect(goneQuiet(doc, NOW).map((n) => n.title)).toEqual(['Old']);
  });

  it('ignores projects, done/cancelled actions, raw inbox captures, and undated nodes', () => {
    const doc = workspace([
      node('proj', { title: 'Proj', project: true, updatedAt: daysAgo(60) }),
      node('done', { title: 'Done', status: 'DONE', updatedAt: daysAgo(60) }),
      node('capture', { title: 'Capture', status: 'BACKLOG', updatedAt: daysAgo(60) }), // in inbox
      node('nostamp', { title: 'NoStamp', status: 'NEXT' }), // no timestamp → can't judge
    ]);
    doc.nodes['projects'].childIds.push('proj');
    doc.nodes['inbox'].childIds.push('capture');
    doc.nodes['actions'].childIds.push('done', 'nostamp');
    expect(goneQuiet(doc, NOW)).toEqual([]);
  });
});
