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

  it('addInboxItem prepends — the newest capture lands first', () => {
    const doc = workspace([node('old')]);
    doc.nodes['inbox'].childIds.push('old');
    const next = applyIntent(doc, { type: 'addInboxItem', id: 'new', title: 'Fresh', now: NOW });
    expect(next.nodes['inbox'].childIds).toEqual(['new', 'old']);
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

  it('convertInboxToAction files the action under the chosen project', () => {
    const doc = workspace([node('p', { project: true }), node('a')]);
    doc.nodes['projects'].childIds.push('p');
    doc.nodes['inbox'].childIds.push('a');
    const next = applyIntent(doc, { type: 'convertInboxToAction', id: 'a', status: 'NEXT', parentId: 'p', now: NOW });
    expect(next.nodes['inbox'].childIds).toEqual([]);
    expect(next.nodes['actions'].childIds).toEqual([]);
    expect(next.nodes['p'].childIds).toEqual(['a']);
    expect(next.nodes['a']).toMatchObject({ status: 'NEXT', project: false });
  });

  it('convertInboxToAction falls back to free actions when the parent is gone', () => {
    const doc = workspace([node('a')]);
    doc.nodes['inbox'].childIds.push('a');
    const next = applyIntent(doc, { type: 'convertInboxToAction', id: 'a', status: 'NEXT', parentId: 'ghost', now: NOW });
    expect(next.nodes['actions'].childIds).toEqual(['a']);
  });

  it('convertInboxToProject nests the new project under the chosen parent', () => {
    const doc = workspace([node('p', { project: true }), node('a')]);
    doc.nodes['projects'].childIds.push('p');
    doc.nodes['inbox'].childIds.push('a');
    const next = applyIntent(doc, { type: 'convertInboxToProject', id: 'a', parentId: 'p', now: NOW });
    expect(next.nodes['projects'].childIds).toEqual(['p']);
    expect(next.nodes['p'].childIds).toEqual(['a']);
    expect(next.nodes['a']).toMatchObject({ project: true });
  });

  it('convertInboxToProject refuses to nest into its own subtree (falls back to top level)', () => {
    const doc = workspace([node('a', { childIds: ['c'] }), node('c')]);
    doc.nodes['inbox'].childIds.push('a');
    const next = applyIntent(doc, { type: 'convertInboxToProject', id: 'a', parentId: 'c', now: NOW });
    expect(next.nodes['projects'].childIds).toEqual(['a']);
    expect(next.nodes['c'].childIds).toEqual([]);
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

  it('addAction creates a leaf action with the given status under the parent', () => {
    const doc = workspace([node('p', { project: true })]);
    doc.nodes['projects'].childIds.push('p');
    const next = applyIntent(doc, { type: 'addAction', parentId: 'p', id: 'a', title: 'Do', status: 'NEXT', now: NOW });
    expect(next.nodes['p'].childIds).toEqual(['a']);
    expect(next.nodes['a']).toMatchObject({ title: 'Do', project: false, status: 'NEXT', createdAt: NOW, statusChangedAt: NOW });
  });

  it('addAction prepends — a new action lands first in the list', () => {
    const doc = workspace([node('p', { project: true, childIds: ['x'] }), node('x')]);
    const next = applyIntent(doc, { type: 'addAction', parentId: 'p', id: 'a', title: 'Do', status: 'NEXT', now: NOW });
    expect(next.nodes['p'].childIds).toEqual(['a', 'x']);
  });

  it('addSubProject creates a project under the parent (no-op if parent gone)', () => {
    const doc = workspace([node('p', { project: true })]);
    doc.nodes['projects'].childIds.push('p');
    const next = applyIntent(doc, { type: 'addSubProject', parentId: 'p', id: 's', title: 'Sub', now: NOW });
    expect(next.nodes['p'].childIds).toEqual(['s']);
    expect(next.nodes['s']).toMatchObject({ title: 'Sub', project: true, createdAt: NOW });
    expect(applyIntent(doc, { type: 'addSubProject', parentId: 'ghost', id: 'x', title: 'X', now: NOW }).nodes['x']).toBeUndefined();
  });

  it('addSubProject prepends — a new project lands first in the list', () => {
    const doc = workspace([node('p', { project: true, childIds: ['x'] }), node('x', { project: true })]);
    const next = applyIntent(doc, { type: 'addSubProject', parentId: 'p', id: 's', title: 'Sub', now: NOW });
    expect(next.nodes['p'].childIds).toEqual(['s', 'x']);
  });

  it('seedProject inserts a rich subtree (status/tags/due/blockedBy/resources) and registers tags', () => {
    const doc = workspace();
    const next = applyIntent(doc, {
      type: 'seedProject',
      parentId: 'projects',
      now: NOW,
      nodes: [
        {
          id: 'demo',
          title: 'Demo',
          project: true,
          children: [
            { id: 'a1', title: 'Done one', status: 'DONE' },
            {
              id: 'a2',
              title: 'Due one',
              status: 'BACKLOG',
              tags: ['Learn', 'learn'],
              dueAt: '2026-07-01',
              resources: [{ type: 'URI', value: 'https://usenam.app', description: null }],
            },
            { id: 'a3', title: 'Blocked one', status: 'BACKLOG', blockedBy: ['a2'] },
          ],
        },
      ],
    });
    // Root project attached under Projects, children in authoring order.
    expect(next.nodes['projects'].childIds).toEqual(['demo']);
    expect(next.nodes['demo']).toMatchObject({ project: true, createdAt: NOW });
    expect(next.nodes['demo'].childIds).toEqual(['a1', 'a2', 'a3']);
    // Rich fields land; DONE gets a statusChangedAt; tags normalized + registered.
    expect(next.nodes['a1']).toMatchObject({ status: 'DONE', statusChangedAt: NOW });
    expect(next.nodes['a2']).toMatchObject({ status: 'BACKLOG', dueAt: '2026-07-01', tags: ['learn'] });
    expect(next.nodes['a2'].resources).toHaveLength(1);
    expect(next.nodes['a3'].blockedBy).toEqual(['a2']);
    expect(next.registeredTags).toEqual(['learn']);
    // No-op if the parent is gone.
    expect(applyIntent(doc, { type: 'seedProject', parentId: 'ghost', now: NOW, nodes: [{ id: 'x', title: 'X' }] }).nodes['x']).toBeUndefined();
  });

  it('groupIntoSubProject creates a sub-project and moves the selected actions into it', () => {
    const doc = workspace([
      node('p', { project: true, childIds: ['a', 'b', 'c'] }),
      node('a'),
      node('b'),
      node('c'),
    ]);
    doc.nodes['projects'].childIds.push('p');
    const next = applyIntent(doc, {
      type: 'groupIntoSubProject',
      parentId: 'p',
      subProjectId: 's',
      title: 'Group',
      actionIds: ['a', 'c'],
      now: NOW,
    });
    expect(next.nodes['s']).toMatchObject({ title: 'Group', project: true, createdAt: NOW });
    expect(next.nodes['p'].childIds).toEqual(['s', 'b']); // a + c moved out; new sub-project lands first
    expect(next.nodes['s'].childIds).toEqual(['a', 'c']);
    expect(
      applyIntent(doc, { type: 'groupIntoSubProject', parentId: 'ghost', subProjectId: 'x', title: 'X', actionIds: [], now: NOW }).nodes['x'],
    ).toBeUndefined();
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

  it('addPrerequisite links a blocker but refuses cycles; removePrerequisite unlinks', () => {
    const doc = workspace([node('a', { status: 'NEXT' }), node('b', { status: 'NEXT' })]);
    doc.nodes['actions'].childIds.push('a', 'b');
    const linked = applyIntent(doc, { type: 'addPrerequisite', actionId: 'a', prereqId: 'b', now: NOW });
    expect(linked.nodes['a']).toMatchObject({ blockedBy: ['b'], updatedAt: NOW });
    // reverse edge would cycle → no-op
    expect(applyIntent(linked, { type: 'addPrerequisite', actionId: 'b', prereqId: 'a', now: NOW })).toEqual(linked);
    const unlinked = applyIntent(linked, { type: 'removePrerequisite', actionId: 'a', prereqId: 'b', now: NOW });
    expect(unlinked.nodes['a'].blockedBy).toEqual([]);
  });

  it('saved views: create (replacing same name), rename, delete', () => {
    const doc = workspace();
    const created = applyIntent(doc, { type: 'createSavedView', name: 'Errands', tags: ['home'], nextOnly: true });
    expect(created.savedViews).toEqual([{ name: 'Errands', tags: ['home'], nextOnly: true }]);
    // same name replaces rather than duplicates
    const replaced = applyIntent(created, { type: 'createSavedView', name: 'Errands', tags: ['town'], nextOnly: false });
    expect(replaced.savedViews).toEqual([{ name: 'Errands', tags: ['town'], nextOnly: false }]);
    const renamed = applyIntent(replaced, { type: 'renameSavedView', oldName: 'Errands', newName: 'Town' });
    expect(renamed.savedViews[0].name).toBe('Town');
    const deleted = applyIntent(renamed, { type: 'deleteSavedView', name: 'Town' });
    expect(deleted.savedViews).toEqual([]);
  });

  it('goal boards: create (replacing same name) and delete', () => {
    const doc = workspace();
    const created = applyIntent(doc, { type: 'createMissionControl', name: 'Q3', tags: ['goal'] });
    expect(created.missionControls).toEqual([{ name: 'Q3', tags: ['goal'] }]);
    const replaced = applyIntent(created, { type: 'createMissionControl', name: 'Q3', tags: ['q3'] });
    expect(replaced.missionControls).toEqual([{ name: 'Q3', tags: ['q3'] }]);
    const deleted = applyIntent(replaced, { type: 'deleteMissionControl', name: 'Q3' });
    expect(deleted.missionControls).toEqual([]);
  });

  it('templates: saveAsTemplate captures the subtree; deleteTemplate removes it', () => {
    const doc = workspace([
      node('p', { project: true, title: 'Reno', childIds: ['s', 'a'] }),
      node('s', { project: true, title: 'Plumbing', childIds: ['b'] }),
      node('a', { title: 'Measure' }),
      node('b', { title: 'Fit pipe' }),
    ]);
    doc.nodes['projects'].childIds.push('p');
    const saved = applyIntent(doc, { type: 'saveAsTemplate', name: 'Reno', nodeId: 'p' });
    expect(saved.templates).toEqual([
      {
        name: 'Reno',
        children: [
          { title: 'Plumbing', project: true, children: [{ title: 'Fit pipe', project: false, children: [] }] },
          { title: 'Measure', project: false, children: [] },
        ],
      },
    ]);
    expect(applyIntent(saved, { type: 'deleteTemplate', name: 'Reno' }).templates).toEqual([]);
  });

  it('applyTemplate clones the provided subtree (with given ids) under the parent', () => {
    const doc = workspace([node('p', { project: true })]);
    doc.nodes['projects'].childIds.push('p');
    const next = applyIntent(doc, {
      type: 'applyTemplate',
      parentId: 'p',
      now: NOW,
      nodes: [
        { id: 's1', title: 'Plumbing', project: true, children: [{ id: 'a1', title: 'Fit pipe', project: false, children: [] }] },
      ],
    });
    expect(next.nodes['p'].childIds).toEqual(['s1']);
    expect(next.nodes['s1']).toMatchObject({ title: 'Plumbing', project: true, childIds: ['a1'], createdAt: NOW });
    expect(next.nodes['a1']).toMatchObject({ title: 'Fit pipe', project: false });
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

describe('reorderView', () => {
  it('stores a per-view manual order without mutating the input', () => {
    const doc = workspace([node('a', { status: 'NEXT' }), node('b', { status: 'NEXT' })]);
    const next = applyIntent(doc, { type: 'reorderView', view: 'next', order: ['b', 'a'] });
    expect(next.viewOrders.next).toEqual(['b', 'a']);
    expect(doc.viewOrders.next).toBeUndefined(); // input untouched
  });

  it('is a document-level op (intentTargetExists is always true)', () => {
    expect(intentTargetExists(workspace(), { type: 'reorderView', view: 'next', order: [] })).toBe(true);
  });
});

describe('updateResources', () => {
  it('replaces a node’s resources and stamps updatedAt', () => {
    const doc = workspace([node('a')]);
    const resources = [{ type: 'URI' as const, value: 'https://x.test', description: null }];
    const next = applyIntent(doc, { type: 'updateResources', id: 'a', resources, now: NOW });
    expect(next.nodes.a.resources).toEqual(resources);
    expect(next.nodes.a.updatedAt).toBe(NOW);
    expect(doc.nodes.a.resources).toEqual([]); // input untouched
  });
});

describe('reorderChildren', () => {
  it("rewrites a parent's childIds order without mutating the input", () => {
    const doc = workspace([node('p', { project: true, childIds: ['a', 'b', 'c'] }), node('a'), node('b'), node('c')]);
    const next = applyIntent(doc, { type: 'reorderChildren', parentId: 'p', order: ['c', 'a', 'b'] });
    expect(next.nodes.p.childIds).toEqual(['c', 'a', 'b']);
    expect(doc.nodes.p.childIds).toEqual(['a', 'b', 'c']); // input untouched
  });

  it('no-ops when the parent is gone', () => {
    const doc = workspace();
    expect(applyIntent(doc, { type: 'reorderChildren', parentId: 'ghost', order: [] })).toEqual(doc);
    expect(intentTargetExists(doc, { type: 'reorderChildren', parentId: 'ghost', order: [] })).toBe(false);
  });
});

describe('registerTag', () => {
  it('adds a standalone tag (normalized) to registeredTags', () => {
    const doc = workspace();
    const next = applyIntent(doc, { type: 'registerTag', tag: '  Home  ' });
    expect(next.registeredTags).toEqual(['home']);
    expect(doc.registeredTags).toEqual([]); // input untouched
  });

  it('de-duplicates against existing registered tags', () => {
    const doc = { ...workspace(), registeredTags: ['home'] };
    const next = applyIntent(doc, { type: 'registerTag', tag: 'HOME' });
    expect(next.registeredTags).toEqual(['home']);
  });

  it('is a document-level intent (no node target required)', () => {
    expect(intentTargetExists(workspace(), { type: 'registerTag', tag: 'x' })).toBe(true);
  });
});

describe('renameTag', () => {
  it('rewrites the tag across nodes and the registered list', () => {
    const doc = { ...workspace([node('a', { tags: ['home'] }), node('b', { tags: ['home', 'work'] })]), registeredTags: ['home'] };
    const next = applyIntent(doc, { type: 'renameTag', from: 'home', to: 'House' });
    expect(next.registeredTags).toEqual(['house']);
    expect(next.nodes.a.tags).toEqual(['house']);
    expect(next.nodes.b.tags).toEqual(['house', 'work']);
  });

  it('merges (de-dups) when the target tag already exists on a node', () => {
    const doc = workspace([node('a', { tags: ['home', 'house'] })]);
    const next = applyIntent(doc, { type: 'renameTag', from: 'home', to: 'house' });
    expect(next.nodes.a.tags).toEqual(['house']);
  });

  it('no-ops on empty or identical names', () => {
    const doc = workspace([node('a', { tags: ['home'] })]);
    expect(applyIntent(doc, { type: 'renameTag', from: 'home', to: 'home' })).toEqual(doc);
  });
});

describe('deleteTag', () => {
  it('removes the tag from every node and the registered list', () => {
    const doc = { ...workspace([node('a', { tags: ['home', 'work'] }), node('b', { tags: ['home'] })]), registeredTags: ['home', 'work'] };
    const next = applyIntent(doc, { type: 'deleteTag', tag: 'home' });
    expect(next.registeredTags).toEqual(['work']);
    expect(next.nodes.a.tags).toEqual(['work']);
    expect(next.nodes.b.tags).toEqual([]);
  });

  it('is a document-level intent', () => {
    expect(intentTargetExists(workspace(), { type: 'deleteTag', tag: 'x' })).toBe(true);
    expect(intentTargetExists(workspace(), { type: 'renameTag', from: 'a', to: 'b' })).toBe(true);
  });
});
