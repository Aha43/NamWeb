import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { applyIntent, cloneTemplateNodes, intentTargetExists, normalizeChildIds, normalizeTags, validateIntent, type Intent } from './mutations';

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

  it('add intents append at the bottom when atTop is false', () => {
    const doc = workspace([node('old'), node('p', { project: true })]);
    doc.nodes['inbox'].childIds.push('old');
    doc.nodes['projects'].childIds.push('p');
    const a = applyIntent(doc, { type: 'addInboxItem', id: 'new', title: 'Fresh', atTop: false, now: NOW });
    expect(a.nodes['inbox'].childIds).toEqual(['old', 'new']);
    const b = applyIntent(doc, { type: 'addAction', parentId: 'p', id: 'x', title: 'X', status: 'NEXT', atTop: false, now: NOW });
    expect(b.nodes['p'].childIds).toEqual(['x']); // empty parent → just the new one
    const c = applyIntent(
      { ...doc, nodes: { ...doc.nodes, p: { ...doc.nodes['p'], childIds: ['e1'] } } },
      { type: 'addSubProject', parentId: 'p', id: 's', title: 'S', atTop: false, now: NOW },
    );
    expect(c.nodes['p'].childIds).toEqual(['e1', 's']);
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

  it('convertInboxToAction/Project apply clarify-time tags additively (#920)', () => {
    const doc = workspace([node('a', { tags: ['existing'] })]);
    doc.nodes['inbox'].childIds.push('a');
    const act = applyIntent(doc, { type: 'convertInboxToAction', id: 'a', status: 'NEXT', tags: ['house-cleaning'], now: NOW });
    expect(act.nodes['a'].tags).toEqual(['existing', 'house-cleaning']); // added to what was there, normalized
    const proj = applyIntent(doc, { type: 'convertInboxToProject', id: 'a', tags: ['Home', 'home'], now: NOW });
    expect(proj.nodes['a'].tags).toEqual(['existing', 'home']); // normalized (lowercased, deduped)
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

  it('an Undo restore with restoreInProgress puts the stripped mark back (#724)', () => {
    let doc = workspace([node('a', { status: 'NEXT', tags: ['home', 'in progress'] })]);
    doc = applyIntent(doc, { type: 'setStatus', id: 'a', status: 'DONE', now: NOW });
    expect(doc.nodes['a'].tags).toEqual(['home']);
    // The undo path: restore the old status AND the mark, guarded like any status undo (#573).
    const undone = applyIntent(doc, {
      type: 'setStatus', id: 'a', status: 'NEXT', expectedStatus: 'DONE', restoreInProgress: true, now: NOW,
    });
    expect(undone.nodes['a'].tags).toEqual(['home', '#in-progress']); // restore writes the sigiled form
    // A stale undo (status changed again since) restores neither status nor tag.
    const changed = applyIntent(doc, { type: 'setStatus', id: 'a', status: 'BACKLOG', now: NOW });
    const stale = applyIntent(changed, {
      type: 'setStatus', id: 'a', status: 'NEXT', expectedStatus: 'DONE', restoreInProgress: true, now: NOW,
    });
    expect(stale.nodes['a']).toMatchObject({ status: 'BACKLOG', tags: ['home'] });
    // restoreInProgress toward a TERMINAL status never applies (the strip wins).
    const terminal = applyIntent(doc, { type: 'setStatus', id: 'a', status: 'CANCELLED', restoreInProgress: true, now: NOW });
    expect(terminal.nodes['a'].tags).toEqual(['home']);
  });

  it('updateTags cannot re-attach in-progress to a terminal node (#724)', () => {
    const doc = workspace([node('a', { status: 'DONE', tags: ['home'] })]);
    const next = applyIntent(doc, { type: 'updateTags', id: 'a', tags: ['home', 'In Progress'], now: NOW });
    expect(next.nodes['a'].tags).toEqual(['home']);
  });

  it('terminal statuses shed the in-progress tag — case-insensitively; restore never re-adds (#716)', () => {
    const doc = workspace([
      node('a', { status: 'NEXT', tags: ['home', 'In Progress'] }), // desktop-cased variant (#654)
      node('b', { status: 'NEXT', tags: ['in progress'] }),
      node('c', { status: 'NEXT', tags: ['in progress'] }),
    ]);
    const done = applyIntent(doc, { type: 'setStatus', id: 'a', status: 'DONE', now: NOW });
    expect(done.nodes['a'].tags).toEqual(['home']);
    const cancelled = applyIntent(doc, { type: 'setStatus', id: 'b', status: 'CANCELLED', now: NOW });
    expect(cancelled.nodes['b'].tags).toEqual([]);
    // Non-terminal changes keep it; restoring a done action does not resurrect it.
    const backlog = applyIntent(doc, { type: 'setStatus', id: 'c', status: 'BACKLOG', now: NOW });
    expect(backlog.nodes['c'].tags).toEqual(['in progress']);
    const restored = applyIntent(done, { type: 'setStatus', id: 'a', status: 'NEXT', now: NOW });
    expect(restored.nodes['a'].tags).toEqual(['home']);
  });

  it('setStatus with expectedStatus no-ops when the node has since changed (#573)', () => {
    const doc = workspace([node('a', { status: 'BACKLOG' })]); // newer change already applied
    doc.nodes['actions'].childIds.push('a');
    // A stale Undo expecting DONE (its toast's change) must not clobber the newer BACKLOG.
    const stale = applyIntent(doc, { type: 'setStatus', id: 'a', status: 'NEXT', now: NOW, expectedStatus: 'DONE' });
    expect(stale.nodes['a'].status).toBe('BACKLOG');
    // With the expectation still holding, it applies normally.
    const fresh = applyIntent(doc, { type: 'setStatus', id: 'a', status: 'NEXT', now: NOW, expectedStatus: 'BACKLOG' });
    expect(fresh.nodes['a'].status).toBe('NEXT');
  });

  it('setStatus honours a statusChangedAt override (the Undo restore, #567)', () => {
    const doc = workspace([node('a', { status: 'NEXT' })]);
    doc.nodes['actions'].childIds.push('a');
    const orig = '2026-01-01T00:00:00.000Z';
    const next = applyIntent(doc, { type: 'setStatus', id: 'a', status: 'DONE', now: NOW, statusChangedAt: orig });
    expect(next.nodes['a']).toMatchObject({ status: 'DONE', updatedAt: NOW, statusChangedAt: orig });
    const cleared = applyIntent(doc, { type: 'setStatus', id: 'a', status: 'DONE', now: NOW, statusChangedAt: null });
    expect(cleared.nodes['a'].statusChangedAt).toBeNull();
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
              dueEndAt: '2026-07-03',
              dueTime: '09:00',
              dueEndTime: '17:30',
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
    expect(next.nodes['a2']).toMatchObject({
      status: 'BACKLOG',
      dueAt: '2026-07-01',
      dueEndAt: '2026-07-03',
      dueTime: '09:00',
      dueEndTime: '17:30',
      tags: ['learn'],
    });
    expect(next.nodes['a2'].resources).toHaveLength(1);
    expect(next.nodes['a3'].blockedBy).toEqual(['a2']);
    expect(next.registeredTags).toEqual(['learn']);
    // No-op if the parent is gone.
    expect(applyIntent(doc, { type: 'seedProject', parentId: 'ghost', now: NOW, nodes: [{ id: 'x', title: 'X' }] }).nodes['x']).toBeUndefined();
  });

  it('seedProject atTop floats the seeded roots to the FRONT of the parent (#864)', () => {
    const doc = workspace([node('projects', { project: false, childIds: ['old1', 'old2'] }), node('old1'), node('old2')]);
    const appended = applyIntent(doc, { type: 'seedProject', parentId: 'projects', now: NOW, nodes: [{ id: 'newp', title: 'New', project: true }] });
    expect(appended.nodes['projects'].childIds).toEqual(['old1', 'old2', 'newp']); // default: appended last
    const fronted = applyIntent(doc, { type: 'seedProject', parentId: 'projects', atTop: true, now: NOW, nodes: [{ id: 'newp', title: 'New', project: true }] });
    expect(fronted.nodes['projects'].childIds).toEqual(['newp', 'old1', 'old2']); // atTop: first, no scrolling
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

  it('convertActionToProject lands the new project FIRST in the list, not appended (#894)', () => {
    const doc = workspace([node('a', { status: 'NEXT' }), node('existing', { project: true })]);
    doc.nodes['actions'].childIds.push('a');
    doc.nodes['projects'].childIds.push('existing');
    const next = applyIntent(doc, { type: 'convertActionToProject', id: 'a', now: NOW });
    expect(next.nodes['projects'].childIds).toEqual(['a', 'existing']); // first — findable without scrolling
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

  it('convertProjectToAction lands the new free action FIRST, not appended (#894)', () => {
    const doc = workspace([node('p', { project: true }), node('existing', { status: 'NEXT' })]);
    doc.nodes['projects'].childIds.push('p');
    doc.nodes['actions'].childIds.push('existing');
    const next = applyIntent(doc, { type: 'convertProjectToAction', id: 'p', status: 'NEXT', now: NOW });
    expect(next.nodes['actions'].childIds).toEqual(['p', 'existing']); // first, not appended
  });

  it('convertProjectToAction floats the arrival to the head of viewOrders.next — /next order, not childIds (#902)', () => {
    // /next renders from viewOrders.next (applyViewOrder appends missing ids at the END), so the
    // childIds unshift alone would strand the arrival at the bottom. The saved order must lead with it.
    const doc = workspace([node('p', { project: true }), node('a', { status: 'NEXT' }), node('b', { status: 'NEXT' })]);
    doc.nodes['projects'].childIds.push('p');
    doc.nodes['actions'].childIds.push('a', 'b');
    doc.viewOrders = { next: ['a', 'b'] };
    const next = applyIntent(doc, { type: 'convertProjectToAction', id: 'p', status: 'NEXT', now: NOW });
    expect(next.viewOrders['next']).toEqual(['p', 'a', 'b']);

    // No prior order → a lone [id] still sorts first (applyViewOrder appends the rest as "fresh").
    const doc2 = workspace([node('p', { project: true })]);
    doc2.nodes['projects'].childIds.push('p');
    const next2 = applyIntent(doc2, { type: 'convertProjectToAction', id: 'p', status: 'NEXT', now: NOW });
    expect(next2.viewOrders['next']).toEqual(['p']);
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

  it('setDeriveDue: on sets the flag; off removes it (absent = off, byte-identical docs) (#706)', () => {
    const doc = workspace([node('p', { project: true })]);
    const on = applyIntent(doc, { type: 'setDeriveDue', id: 'p', on: true, now: 't' });
    expect(on.nodes['p'].deriveDue).toBe(true);
    expect(on.nodes['p'].updatedAt).toBe('t');
    const off = applyIntent(on, { type: 'setDeriveDue', id: 'p', on: false, now: 't2' });
    expect('deriveDue' in off.nodes['p']).toBe(false);
  });

  it('seedProject carries deriveDue for project nodes (#711)', () => {
    const doc = workspace();
    const seeded = applyIntent(doc, {
      type: 'seedProject',
      parentId: doc.projectsNodeId,
      nodes: [{ id: 'p', title: 'Trip', project: true, deriveDue: true, children: [] }],
      now: 't',
    });
    expect(seeded.nodes['p'].deriveDue).toBe(true);
  });

  it('convertProjectToAction drops the projects-only deriveDue flag (#711)', () => {
    let doc = workspace([node('p', { project: true, deriveDue: true })]);
    doc = applyIntent(doc, { type: 'convertProjectToAction', id: 'p', status: 'NEXT', now: 't' });
    expect(doc.nodes['p'].project).toBe(false);
    expect('deriveDue' in doc.nodes['p']).toBe(false);
  });

  it('templates: saveAsTemplate captures the FULL subtree (#863); deleteTemplate removes it', () => {
    const doc = workspace([
      node('p', { project: true, title: 'Reno', childIds: ['s', 'a'] }),
      node('s', { project: true, title: 'Plumbing', childIds: ['b'] }),
      node('a', { title: 'Measure', status: 'NEXT', tags: ['home'], dueAt: '2027-01-05', resources: [{ type: 'COUNT', value: '0/3', description: 'coats' }] }),
      node('b', { title: 'Fit pipe' }),
    ]);
    doc.nodes['projects'].childIds.push('p');
    const saved = applyIntent(doc, { type: 'saveAsTemplate', name: 'Reno', nodeId: 'p' });
    // Rich fields captured; actions become NEXT (draft-to-review, #864); projects keep the default;
    // empty tags/resources / no due omitted for leanness.
    expect(saved.templates).toEqual([
      {
        name: 'Reno',
        children: [
          { id: 's', title: 'Plumbing', project: true, children: [{ id: 'b', title: 'Fit pipe', project: false, status: 'NEXT', children: [] }] },
          { id: 'a', title: 'Measure', project: false, status: 'NEXT', tags: ['home'], dueAt: '2027-01-05', resources: [{ type: 'COUNT', value: '0/3', description: 'coats' }], children: [] },
        ],
      },
    ]);
    expect(applyIntent(saved, { type: 'deleteTemplate', name: 'Reno' }).templates).toEqual([]);
  });

  it('captures every action as NEXT so a template instance is a draft to review (#864)', () => {
    const doc = workspace([
      node('p', { project: true, childIds: ['done', 'back', 'sub'] }),
      node('done', { title: 'Done thing', status: 'DONE' }),
      node('back', { title: 'Later thing', status: 'BACKLOG' }),
      node('sub', { project: true, title: 'Sub', status: 'ARCHIVED' }),
    ]);
    doc.nodes['projects'].childIds.push('p');
    const kids = applyIntent(doc, { type: 'saveAsTemplate', name: 'T', nodeId: 'p' }).templates[0].children;
    expect(kids.find((k) => k.title === 'Done thing')!.status).toBe('NEXT'); // DONE → NEXT: no bogus "done"
    expect(kids.find((k) => k.title === 'Later thing')!.status).toBe('NEXT'); // BACKLOG → NEXT: surfaced for review
    expect(kids.find((k) => k.title === 'Sub')!.status).toBeUndefined(); // a project keeps the default
  });

  it('applyTemplate reproduces the full node and remaps intra-template blockers (#863)', () => {
    const doc = workspace([
      node('p', { project: true, childIds: ['x', 'y'] }),
      node('x', { title: 'Design', status: 'NEXT' }),
      node('y', { title: 'Build', tags: ['t'], dueAt: '2027-02-02', resources: [{ type: 'URI', value: 'https://spec', description: null }], blockedBy: ['x'] }),
    ]);
    doc.nodes['projects'].childIds.push('p');
    const saved = applyIntent(doc, { type: 'saveAsTemplate', name: 'Plan', nodeId: 'p' });
    // Clone with deterministic fresh ids, then apply under a different fresh project.
    const ids = ['nx', 'ny'];
    let i = 0;
    const nodes = cloneTemplateNodes(saved.templates[0].children, () => ids[i++]);
    const target = workspace([node('q', { project: true })]);
    target.nodes['projects'].childIds.push('q');
    const next = applyIntent(target, { type: 'applyTemplate', parentId: 'q', nodes, now: NOW });
    expect(next.nodes['q'].childIds).toEqual(['nx', 'ny']);
    expect(next.nodes['nx']).toMatchObject({ title: 'Design', status: 'NEXT', createdAt: NOW });
    expect(next.nodes['ny']).toMatchObject({
      title: 'Build',
      status: 'NEXT', // the source 'Build' was BACKLOG; a template action lands as NEXT (#864)
      tags: ['t'],
      dueAt: '2027-02-02',
      resources: [{ type: 'URI', value: 'https://spec', description: null }],
      blockedBy: ['nx'], // remapped from the captured 'x' to the fresh clone id
    });
  });

  it('applyTemplate remaps an intra-template action-link, but keeps a link to an outside target (#876)', () => {
    const doc = workspace([
      node('p', { project: true, childIds: ['x', 'y'] }),
      node('x', { title: 'Design' }),
      // 'y' links to sibling 'x' (in the template) AND to 'out' (outside it).
      node('y', {
        title: 'Build',
        resources: [
          { type: 'URI', value: 'nam://action/x', description: null },
          { type: 'URI', value: 'nam://action/out', description: null },
        ],
      }),
      node('out', { title: 'Elsewhere' }),
    ]);
    doc.nodes['projects'].childIds.push('p');
    doc.nodes['actions'].childIds.push('out');
    const saved = applyIntent(doc, { type: 'saveAsTemplate', name: 'Plan', nodeId: 'p' });
    const ids = ['nx', 'ny'];
    let i = 0;
    const nodes = cloneTemplateNodes(saved.templates[0].children, () => ids[i++]);
    const target = workspace([node('q', { project: true })]);
    target.nodes['projects'].childIds.push('q');
    const next = applyIntent(target, { type: 'applyTemplate', parentId: 'q', nodes, now: NOW });
    // The in-template link now points at the CLONED 'x' (nx), not the source 'x'; the outside link is untouched.
    expect(next.nodes['ny'].resources).toEqual([
      { type: 'URI', value: 'nam://action/nx', description: null },
      { type: 'URI', value: 'nam://action/out', description: null },
    ]);
  });

  it('applyTemplate still applies a legacy structure-only template (defaults, no crash)', () => {
    const doc = workspace([node('p', { project: true })]);
    doc.nodes['projects'].childIds.push('p');
    const nodes = cloneTemplateNodes([{ title: 'Old', project: false, children: [] }], () => 'leg');
    const next = applyIntent(doc, { type: 'applyTemplate', parentId: 'p', nodes, now: NOW });
    expect(next.nodes['p'].childIds).toEqual(['leg']);
    expect(next.nodes['leg']).toMatchObject({ title: 'Old', status: 'BACKLOG', tags: [], resources: [], blockedBy: [] });
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

  it('the # namespace (#837/#844): known tags canonicalize + legacy migrates; unknown #… stays ordinary', () => {
    // Known system tags are canonicalized; the legacy `in progress` spelling migrates on write.
    expect(normalizeTags(['In Progress', 'home'])).toEqual(['#in-progress', 'home']);
    expect(normalizeTags(['#Shared-Hide', '#SHARED-HIDE'])).toEqual(['#shared-hide']);
    // An UNKNOWN #… tag is kept AS-IS (semantic reservation only — never rewritten, #844).
    expect(normalizeTags(['home', '#invented', '#shared-hide'])).toEqual(['home', '#invented', '#shared-hide']);
    // Context tags (@…) untouched. And it's IDEMPOTENT — a second pass is a no-op (#844/#1).
    const once = normalizeTags(['@phone', 'GROCERIES', '#in progress', '#invented']);
    expect(once).toEqual(['@phone', 'groceries', '#in progress', '#invented']);
    expect(normalizeTags(once)).toEqual(once);
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

  // #1141 — the reorder is REPLAYED verbatim onto a freshly-pulled doc on conflict. Reconcile against
  // the current children so a concurrent move isn't undone (which would alias a node into two parents).
  it('drops ids a concurrent writer already moved out of this parent (no resurrection/alias)', () => {
    // Fresh doc: 'b' was moved to a sibling since the reorder was captured. Replaying order ['b','a']
    // must NOT put 'b' back under p — it lives under q now.
    const doc = workspace([
      node('p', { project: true, childIds: ['a'] }),
      node('q', { project: true, childIds: ['b'] }),
      node('a'),
      node('b'),
    ]);
    const next = applyIntent(doc, { type: 'reorderChildren', parentId: 'p', order: ['b', 'a'] });
    expect(next.nodes.p.childIds).toEqual(['a']); // 'b' not resurrected
    expect(next.nodes.q.childIds).toEqual(['b']); // still solely under q — no alias
  });

  it('keeps a child the captured order never mentioned (a concurrent move-in), appended', () => {
    const doc = workspace([node('p', { project: true, childIds: ['a', 'b', 'x'] }), node('a'), node('b'), node('x')]);
    // Order captured before 'x' arrived under p.
    const next = applyIntent(doc, { type: 'reorderChildren', parentId: 'p', order: ['b', 'a'] });
    expect(next.nodes.p.childIds).toEqual(['b', 'a', 'x']); // reordered pair, 'x' preserved at the tail
  });
});

describe('detach removes a node from ALL parents (#1141)', () => {
  it('deleteLeaf clears an aliased id from both parents (no dangling residue)', () => {
    // Corrupt starting state: 'y' aliased into two projects.
    const doc = workspace([
      node('p', { project: true, childIds: ['y'] }),
      node('q', { project: true, childIds: ['y'] }),
      node('y'),
    ]);
    const next = applyIntent(doc, { type: 'deleteLeaf', id: 'y' });
    expect(next.nodes.y).toBeUndefined();
    expect(next.nodes.p.childIds).toEqual([]); // both cleaned — not just the first
    expect(next.nodes.q.childIds).toEqual([]);
  });
});

describe('normalizeChildIds (#1141 self-heal)', () => {
  it('prunes dangling child ids (the residue a delete of an aliased node leaves)', () => {
    const doc = workspace([node('p', { project: true, childIds: ['a', 'ghost'] }), node('a')]);
    expect(normalizeChildIds(doc)).toBe(true);
    expect(doc.nodes.p.childIds).toEqual(['a']);
  });

  it('collapses an aliased id to a single (first) parent', () => {
    const doc = workspace([
      node('p', { project: true, childIds: ['y'] }),
      node('q', { project: true, childIds: ['y'] }),
      node('y'),
    ]);
    expect(normalizeChildIds(doc)).toBe(true);
    const owners = [doc.nodes.p, doc.nodes.q].filter((n) => n.childIds.includes('y'));
    expect(owners).toHaveLength(1); // exactly one parent keeps it
  });

  it('is a no-op (returns false, untouched) on a healthy doc', () => {
    const doc = workspace([node('p', { project: true, childIds: ['a', 'b'] }), node('a'), node('b')]);
    const before = structuredClone(doc);
    expect(normalizeChildIds(doc)).toBe(false);
    expect(doc).toEqual(before);
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

describe('system tags (#651)', () => {
  it('renameTag refuses a system tag', () => {
    const doc = { ...workspace([node('a', { tags: ['in progress'] })]), registeredTags: [] };
    const next = applyIntent(doc, { type: 'renameTag', from: 'in progress', to: 'busy' });
    expect(next.nodes.a.tags).toEqual(['in progress']);
  });

  it('deleteTag refuses a system tag', () => {
    const doc = { ...workspace([node('a', { tags: ['in progress', 'home'] })]), registeredTags: [] };
    const next = applyIntent(doc, { type: 'deleteTag', tag: 'in progress' });
    expect(next.nodes.a.tags).toEqual(['in progress', 'home']);
  });

  it('renameTag carries the context manual order to the new tag (#1036 review, P2)', () => {
    const doc = { ...workspace([node('a', { tags: ['work'] })]), registeredTags: ['work'] };
    doc.viewOrders = { 'context:work': ['a', 'b'], 'context:home+work': ['a'] };
    const next = applyIntent(doc, { type: 'renameTag', from: 'work', to: 'job' });
    expect(next.viewOrders['context:job']).toEqual(['a', 'b']);
    expect(next.viewOrders['context:home+job']).toEqual(['a']);
    expect(next.viewOrders['context:work']).toBeUndefined();
  });

  it('deleteTag drops the context order that references the deleted tag (#1036 review)', () => {
    const doc = { ...workspace([node('a', { tags: ['work'] })]), registeredTags: ['work'] };
    doc.viewOrders = { 'context:work': ['a'], 'context:home': ['b'] };
    const next = applyIntent(doc, { type: 'deleteTag', tag: 'work' });
    expect(next.viewOrders['context:work']).toBeUndefined();
    expect(next.viewOrders['context:home']).toEqual(['b']);
  });
});

describe('addAction scheduling (#681)', () => {
  it('creates the action with dueAt/dueTime when given, null otherwise', () => {
    const doc = workspace();
    const next = applyIntent(doc, {
      type: 'addAction', parentId: 'actions', id: 'n1', title: 'Party', status: 'NEXT',
      dueAt: '2026-07-20', dueTime: '12:00', now: '2026-07-07T10:00:00',
    });
    expect(next.nodes.n1).toMatchObject({ dueAt: '2026-07-20', dueTime: '12:00', status: 'NEXT' });
    const plain = applyIntent(doc, {
      type: 'addAction', parentId: 'actions', id: 'n2', title: 'Plain', status: 'NEXT', now: '2026-07-07T10:00:00',
    });
    expect(plain.nodes.n2).toMatchObject({ dueAt: null, dueTime: null });
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

  it('leaves project bookmarks untouched (they carry no tags, #1107)', () => {
    const doc = workspace([node('a', { tags: ['home'] })]);
    doc.bookmarks = [{ id: 'b3', label: 'Vacation', kind: 'project', projectId: 'p', color: '#333' }];
    const next = applyIntent(doc, { type: 'renameTag', from: 'home', to: 'work' });
    expect(next.bookmarks).toEqual(doc.bookmarks);
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

  it('leaves project bookmarks untouched (they carry no tags, #1107)', () => {
    const doc = workspace([node('a', { tags: ['home'] })]);
    doc.bookmarks = [{ id: 'b3', label: 'Vacation', kind: 'project', projectId: 'p', color: '#333' }];
    const next = applyIntent(doc, { type: 'deleteTag', tag: 'home' });
    expect(next.bookmarks).toEqual(doc.bookmarks);
  });

  it('is a document-level intent', () => {
    expect(intentTargetExists(workspace(), { type: 'deleteTag', tag: 'x' })).toBe(true);
    expect(intentTargetExists(workspace(), { type: 'renameTag', from: 'a', to: 'b' })).toBe(true);
  });
});

describe('setDue with a date range (#438)', () => {
  it('sets both the start and the end', () => {
    const next = applyIntent(workspace([node('a')]), {
      type: 'setDue',
      id: 'a',
      dueAt: '2026-08-12',
      dueEndAt: '2026-08-16',
      now: NOW,
    });
    expect(next.nodes.a).toMatchObject({ dueAt: '2026-08-12', dueEndAt: '2026-08-16' });
  });

  it('leaves an existing end untouched when the intent omits dueEndAt', () => {
    const doc = workspace([node('a', { dueAt: '2026-08-12', dueEndAt: '2026-08-16' })]);
    const next = applyIntent(doc, { type: 'setDue', id: 'a', dueAt: '2026-08-13', now: NOW });
    expect(next.nodes.a).toMatchObject({ dueAt: '2026-08-13', dueEndAt: '2026-08-16' });
  });

  it('clears the end when the start is cleared', () => {
    const doc = workspace([node('a', { dueAt: '2026-08-12', dueEndAt: '2026-08-16' })]);
    const next = applyIntent(doc, { type: 'setDue', id: 'a', dueAt: null, now: NOW });
    expect(next.nodes.a.dueAt).toBeNull();
    expect(next.nodes.a.dueEndAt).toBeNull();
  });
});

describe('validateIntent — #checklist no-sub-projects invariant (#1147)', () => {
  // A checklist project `cl` with one check-item `ci`; a normal project `p` that has a sub-project.
  function doc() {
    return workspace([
      node('cl', { project: true, tags: ['#checklist'], childIds: ['ci'] }),
      node('ci', { project: false }),
      node('p', { project: true, childIds: ['pa', 'sub'] }),
      node('pa', { project: false }),
      node('sub', { project: true }),
    ]);
  }

  it('rejects adding a sub-project under a checklist, allows it under a normal project', () => {
    expect(validateIntent(doc(), { type: 'addSubProject', parentId: 'cl', id: 'x', title: 'x', now: NOW })).toMatch(/checklist/i);
    expect(validateIntent(doc(), { type: 'addSubProject', parentId: 'p', id: 'x', title: 'x', now: NOW })).toBeNull();
  });

  it('rejects grouping selected actions into a sub-project under a checklist', () => {
    expect(
      validateIntent(doc(), { type: 'groupIntoSubProject', parentId: 'cl', subProjectId: 's', actionIds: ['ci'], title: 't', now: NOW }),
    ).toMatch(/checklist/i);
  });

  it('rejects moving a PROJECT into a checklist, but allows moving an ACTION in (a check-item)', () => {
    expect(validateIntent(doc(), { type: 'moveNode', id: 'sub', newParentId: 'cl', now: NOW })).toMatch(/checklist/i);
    expect(validateIntent(doc(), { type: 'moveNode', id: 'pa', newParentId: 'cl', now: NOW })).toBeNull();
  });

  it('rejects converting a check-item (action under a checklist) into a project', () => {
    expect(validateIntent(doc(), { type: 'convertActionToProject', id: 'ci', now: NOW })).toMatch(/checklist/i);
  });

  it('rejects tagging a project that has sub-projects as #checklist; allows it on a leaf project', () => {
    expect(validateIntent(doc(), { type: 'updateTags', id: 'p', tags: ['#checklist'], now: NOW })).toMatch(/checklist/i);
    // `cl` is already a checklist with no sub-projects — re-saving its tags is fine.
    expect(validateIntent(doc(), { type: 'updateTags', id: 'cl', tags: ['#checklist'], now: NOW })).toBeNull();
    // A leaf project (no sub-projects) can become a checklist.
    expect(validateIntent(doc(), { type: 'updateTags', id: 'sub', tags: ['#checklist'], now: NOW })).toBeNull();
  });

  it('applyIntent is a no-op backstop: a violating intent leaves the document unchanged', () => {
    const before = doc();
    const after = applyIntent(before, { type: 'addSubProject', parentId: 'cl', id: 'x', title: 'x', now: NOW });
    expect(after).toEqual(before); // the checklist gained no child project; nothing corrupted
    expect(after.nodes.x).toBeUndefined();
  });

  // #1159 — the project-creating/restoring intents Codex flagged that also hit the reducer hole.
  it('rejects processing an inbox item into a project under a checklist (convertInboxToProject)', () => {
    expect(validateIntent(doc(), { type: 'convertInboxToProject', id: 'ci', parentId: 'cl', now: NOW })).toMatch(/checklist/i);
    expect(validateIntent(doc(), { type: 'convertInboxToProject', id: 'ci', parentId: 'p', now: NOW })).toBeNull();
    expect(validateIntent(doc(), { type: 'convertInboxToProject', id: 'ci', now: NOW })).toBeNull(); // no parent → top level
  });

  it('rejects a template/seed with a top-level project under a checklist, allows an all-action seed', () => {
    const projSeed = [{ id: 's', title: 'Sub', project: true }];
    const actionSeed = [{ id: 's', title: 'Item' }];
    expect(validateIntent(doc(), { type: 'seedProject', parentId: 'cl', nodes: projSeed, now: NOW })).toMatch(/checklist/i);
    expect(validateIntent(doc(), { type: 'applyTemplate', parentId: 'cl', nodes: projSeed, now: NOW })).toMatch(/checklist/i);
    expect(validateIntent(doc(), { type: 'seedProject', parentId: 'cl', nodes: actionSeed, now: NOW })).toBeNull(); // checklist template
    expect(validateIntent(doc(), { type: 'seedProject', parentId: 'p', nodes: projSeed, now: NOW })).toBeNull(); // normal parent
  });

  it('rejects undo restoring a sub-project under a checklist, allows restoring an action', () => {
    const cap = (root: NamNode) => ({ type: 'restoreNodes' as const, capture: { nodes: [root], parentId: 'cl', index: 0, blockedRefs: [] } });
    expect(validateIntent(doc(), cap(node('r', { project: true })))).toMatch(/checklist/i);
    expect(validateIntent(doc(), cap(node('r', { project: false })))).toBeNull(); // an action check-item is fine
  });
});

describe('resetChecklist (#1165)', () => {
  it('sets DONE direct-child actions back to BACKLOG, leaving others and sub-projects untouched', () => {
    const doc = workspace([
      node('cl', { project: true, tags: ['#checklist'], childIds: ['a', 'b', 'c', 'sub'] }),
      node('a', { status: 'DONE', statusChangedAt: 'old' }),
      node('b', { status: 'BACKLOG' }),
      node('c', { status: 'DONE' }),
      node('sub', { project: true, status: 'DONE' }), // a project child is not a check-item
      node('outside', { status: 'DONE' }),
    ]);
    const next = applyIntent(doc, { type: 'resetChecklist', id: 'cl', now: NOW });
    expect(next.nodes.a.status).toBe('BACKLOG');
    expect(next.nodes.a.statusChangedAt).toBe(NOW);
    expect(next.nodes.c.status).toBe('BACKLOG');
    expect(next.nodes.sub.status).toBe('DONE'); // sub-project isn't a check-item
    expect(next.nodes.outside.status).toBe('DONE'); // not a child of the checklist
  });

  it('no-ops when the project is gone', () => {
    const doc = workspace([]);
    expect(applyIntent(doc, { type: 'resetChecklist', id: 'ghost', now: NOW })).toEqual(doc);
  });
});
