import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { applyIntent, intentTargetExists, type Intent } from './mutations';

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

  it('no-ops when a status/delete target is missing (replay safety)', () => {
    const doc = workspace();
    expect(applyIntent(doc, { type: 'setStatus', id: 'ghost', status: 'DONE', now: NOW })).toEqual(doc);
    expect(applyIntent(doc, { type: 'deleteLeaf', id: 'ghost' })).toEqual(doc);
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
