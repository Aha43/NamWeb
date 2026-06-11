import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { applyIntent, intentTargetExists, normalizeTags, type Intent } from './mutations';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id,
    title: id,
    description: null,
    status: 'BACKLOG',
    project: false,
    childIds: [],
    tags: [],
    blockedBy: [],
    resources: [],
    createdAt: null,
    updatedAt: null,
    statusChangedAt: null,
    dueAt: null,
    ...partial,
  };
}

function workspace(extra: NamNode[] = []): WorkspaceDocument {
  const root = node('root', { childIds: ['inbox', 'projects', 'actions'] });
  const inbox = node('inbox');
  const projects = node('projects');
  const actions = node('actions');
  const nodes: Record<string, NamNode> = {};
  for (const n of [root, inbox, projects, actions, ...extra]) nodes[n.id] = n;
  return {
    formatVersion: 1,
    rootNodeId: 'root',
    inboxNodeId: 'inbox',
    projectsNodeId: 'projects',
    nextActionsNodeId: 'actions',
    nodes,
    registeredTags: [],
    savedViews: [],
    missionControls: [],
    templates: [],
    viewOrders: {},
  };
}

const NOW = '2026-06-10T12:00:00';

describe('applyIntent', () => {
  it('does not mutate the input document', () => {
    const doc = workspace();
    const before = structuredClone(doc);
    applyIntent(doc, { type: 'addInboxItem', id: 'a', title: 'Buy milk', now: NOW });
    expect(doc).toEqual(before);
  });

  it('addInboxItem creates a BACKLOG node under the inbox', () => {
    const next = applyIntent(workspace(), { type: 'addInboxItem', id: 'a', title: 'Buy milk', now: NOW });
    expect(next.nodes['inbox'].childIds).toEqual(['a']);
    expect(next.nodes['a']).toMatchObject({ title: 'Buy milk', status: 'BACKLOG', createdAt: NOW, updatedAt: NOW });
  });

  it('convertInboxToNext moves the node to actions and sets NEXT', () => {
    const doc = workspace([node('a')]);
    doc.nodes['inbox'].childIds.push('a');
    const intent: Intent = { type: 'convertInboxToNext', id: 'a', now: NOW };
    const next = applyIntent(doc, intent);
    expect(next.nodes['inbox'].childIds).toEqual([]);
    expect(next.nodes['actions'].childIds).toEqual(['a']);
    expect(next.nodes['a']).toMatchObject({ status: 'NEXT', updatedAt: NOW, statusChangedAt: NOW });
  });

  it('convertInboxToAction moves to actions with the given status', () => {
    const doc = workspace([node('a')]);
    doc.nodes['inbox'].childIds.push('a');
    const next = applyIntent(doc, { type: 'convertInboxToAction', id: 'a', status: 'BACKLOG', now: NOW });
    expect(next.nodes['inbox'].childIds).toEqual([]);
    expect(next.nodes['actions'].childIds).toEqual(['a']);
    expect(next.nodes['a']).toMatchObject({ status: 'BACKLOG', project: false, updatedAt: NOW, statusChangedAt: NOW });
  });

  it('convertInboxToProject moves to projects and sets project=true', () => {
    const doc = workspace([node('a')]);
    doc.nodes['inbox'].childIds.push('a');
    const next = applyIntent(doc, { type: 'convertInboxToProject', id: 'a', now: NOW });
    expect(next.nodes['inbox'].childIds).toEqual([]);
    expect(next.nodes['projects'].childIds).toEqual(['a']);
    expect(next.nodes['a']).toMatchObject({ project: true, updatedAt: NOW });
  });

  it('setStatus stamps status and timestamps', () => {
    const doc = workspace([node('a', { status: 'NEXT' })]);
    doc.nodes['actions'].childIds.push('a');
    const next = applyIntent(doc, { type: 'setStatus', id: 'a', status: 'DONE', now: NOW });
    expect(next.nodes['a']).toMatchObject({ status: 'DONE', updatedAt: NOW, statusChangedAt: NOW });
  });

  it('deleteLeaf removes the node and detaches it from its parent', () => {
    const doc = workspace([node('a')]);
    doc.nodes['actions'].childIds.push('a');
    const next = applyIntent(doc, { type: 'deleteLeaf', id: 'a' });
    expect(next.nodes['a']).toBeUndefined();
    expect(next.nodes['actions'].childIds).toEqual([]);
  });

  it('updateNode sets title and description and stamps updatedAt', () => {
    const doc = workspace([node('a', { title: 'old', description: null })]);
    const next = applyIntent(doc, {
      type: 'updateNode',
      id: 'a',
      title: 'new title',
      description: 'some notes',
      now: NOW,
    });
    expect(next.nodes['a']).toMatchObject({ title: 'new title', description: 'some notes', updatedAt: NOW });
    // updateNode leaves status untouched.
    expect(next.nodes['a'].status).toBe('BACKLOG');
  });

  it('setDue sets the due date (and clears it with null)', () => {
    const doc = workspace([node('a')]);
    const due = applyIntent(doc, { type: 'setDue', id: 'a', dueAt: '2026-07-01', now: NOW });
    expect(due.nodes['a']).toMatchObject({ dueAt: '2026-07-01', updatedAt: NOW });
    const cleared = applyIntent(due, { type: 'setDue', id: 'a', dueAt: null, now: NOW });
    expect(cleared.nodes['a'].dueAt).toBeNull();
  });

  it('updateTags normalizes (trim, lowercase, de-dupe) and stamps updatedAt', () => {
    const doc = workspace([node('a')]);
    const next = applyIntent(doc, {
      type: 'updateTags',
      id: 'a',
      tags: ['  Phone ', 'phone', 'Home', ''],
      now: NOW,
    });
    expect(next.nodes['a'].tags).toEqual(['phone', 'home']);
    expect(next.nodes['a'].updatedAt).toBe(NOW);
  });

  it('addSubProject creates a project under the parent (no-op if parent gone)', () => {
    const doc = workspace([node('p', { project: true })]);
    doc.nodes['projects'].childIds.push('p');
    const next = applyIntent(doc, { type: 'addSubProject', parentId: 'p', id: 's', title: 'Sub', now: NOW });
    expect(next.nodes['p'].childIds).toEqual(['s']);
    expect(next.nodes['s']).toMatchObject({ title: 'Sub', project: true, createdAt: NOW });
    expect(applyIntent(doc, { type: 'addSubProject', parentId: 'ghost', id: 'x', title: 'X', now: NOW }).nodes['x']).toBeUndefined();
  });

  it('moveNode reparents but refuses cycles, self, and structural moves', () => {
    const doc = workspace([
      node('p1', { project: true, childIds: ['p2'] }),
      node('p2', { project: true }),
      node('a'),
    ]);
    doc.nodes['projects'].childIds.push('p1');
    doc.nodes['actions'].childIds.push('a');

    const moved = applyIntent(doc, { type: 'moveNode', id: 'a', newParentId: 'p2', now: NOW });
    expect(moved.nodes['actions'].childIds).toEqual([]);
    expect(moved.nodes['p2'].childIds).toEqual(['a']);

    // cycle: can't move p1 under its own descendant p2
    expect(applyIntent(doc, { type: 'moveNode', id: 'p1', newParentId: 'p2', now: NOW })).toEqual(doc);
    // self
    expect(applyIntent(doc, { type: 'moveNode', id: 'a', newParentId: 'a', now: NOW })).toEqual(doc);
    // structural container can't be moved
    expect(applyIntent(doc, { type: 'moveNode', id: 'inbox', newParentId: 'p1', now: NOW })).toEqual(doc);
  });

  it('convertActionToProject flags project and lifts a free action to top-level', () => {
    const doc = workspace([node('a', { status: 'NEXT' })]);
    doc.nodes['actions'].childIds.push('a');
    const next = applyIntent(doc, { type: 'convertActionToProject', id: 'a', now: NOW });
    expect(next.nodes['a']).toMatchObject({ project: true, updatedAt: NOW });
    expect(next.nodes['actions'].childIds).toEqual([]);
    expect(next.nodes['projects'].childIds).toEqual(['a']);
  });

  it('convertProjectToAction only converts leaf projects', () => {
    const doc = workspace([node('p', { project: true, childIds: ['c'] }), node('c', { project: true })]);
    doc.nodes['projects'].childIds.push('p');
    // p has a child → no-op
    expect(applyIntent(doc, { type: 'convertProjectToAction', id: 'p', status: 'NEXT', now: NOW })).toEqual(doc);
    // leaf c converts
    const next = applyIntent(doc, { type: 'convertProjectToAction', id: 'c', status: 'NEXT', now: NOW });
    expect(next.nodes['c']).toMatchObject({ project: false, status: 'NEXT', updatedAt: NOW });
  });

  it('deleteRecursive removes the subtree and sweeps blockedBy refs', () => {
    const doc = workspace([
      node('p', { project: true, childIds: ['c'] }),
      node('c'),
      node('blocked', { blockedBy: ['c'] }),
    ]);
    doc.nodes['projects'].childIds.push('p');
    doc.nodes['actions'].childIds.push('blocked');
    const next = applyIntent(doc, { type: 'deleteRecursive', id: 'p' });
    expect(next.nodes['p']).toBeUndefined();
    expect(next.nodes['c']).toBeUndefined();
    expect(next.nodes['projects'].childIds).toEqual([]);
    expect(next.nodes['blocked'].blockedBy).toEqual([]);
  });

  it('no-ops when a status/delete/edit target is missing (replay safety)', () => {
    const doc = workspace();
    expect(applyIntent(doc, { type: 'setStatus', id: 'ghost', status: 'DONE', now: NOW })).toEqual(doc);
    expect(applyIntent(doc, { type: 'deleteLeaf', id: 'ghost' })).toEqual(doc);
    expect(applyIntent(doc, { type: 'updateNode', id: 'ghost', title: 't', description: null, now: NOW })).toEqual(doc);
    expect(applyIntent(doc, { type: 'setDue', id: 'ghost', dueAt: '2026-07-01', now: NOW })).toEqual(doc);
    expect(applyIntent(doc, { type: 'updateTags', id: 'ghost', tags: ['x'], now: NOW })).toEqual(doc);
  });
});

describe('normalizeTags', () => {
  it('trims, lower-cases, de-duplicates, and drops empties (order preserved)', () => {
    expect(normalizeTags(['  Phone ', 'PHONE', 'home', '', '  '])).toEqual(['phone', 'home']);
  });
});

describe('intentTargetExists', () => {
  it('is always true for addInboxItem (it creates the node)', () => {
    expect(intentTargetExists(workspace(), { type: 'addInboxItem', id: 'a', title: 't', now: NOW })).toBe(true);
  });

  it('reflects whether the target node is present for other intents', () => {
    const doc = workspace([node('a')]);
    expect(intentTargetExists(doc, { type: 'setStatus', id: 'a', status: 'DONE', now: NOW })).toBe(true);
    expect(intentTargetExists(doc, { type: 'deleteLeaf', id: 'ghost' })).toBe(false);
  });
});
