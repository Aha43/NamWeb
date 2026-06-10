import { describe, expect, it } from 'vitest';
import type { NamNode, NodeStatus, WorkspaceDocument } from './types';
import { backlogItems, buildParentIndex, inboxItems, nextActions, structuralNodeIds } from './lenses';

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

// Structural skeleton: root → [inbox, projects, actions]. Tests add their own nodes.
function workspace(extra: NamNode[] = [], wire: (doc: WorkspaceDocument) => void = () => {}): WorkspaceDocument {
  const root = node('root', { title: 'NAM', childIds: ['inbox', 'projects', 'actions'] });
  const inbox = node('inbox', { title: 'Inbox' });
  const projects = node('projects', { title: 'Projects' });
  const actions = node('actions', { title: 'Actions' });
  const nodes: Record<string, NamNode> = {};
  for (const n of [root, inbox, projects, actions, ...extra]) nodes[n.id] = n;
  const doc: WorkspaceDocument = {
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
  wire(doc);
  return doc;
}

function ids(ns: NamNode[]): string[] {
  return ns.map((n) => n.id);
}

function addChild(doc: WorkspaceDocument, parentId: string, childId: string) {
  doc.nodes[parentId].childIds.push(childId);
}

describe('structuralNodeIds', () => {
  it('returns the four container ids', () => {
    const doc = workspace();
    expect([...structuralNodeIds(doc)].sort()).toEqual(['actions', 'inbox', 'projects', 'root']);
  });
});

describe('buildParentIndex', () => {
  it('maps each child to its parent', () => {
    const doc = workspace([node('a')], (d) => addChild(d, 'inbox', 'a'));
    expect(buildParentIndex(doc).get('a')).toBe('inbox');
    expect(buildParentIndex(doc).get('inbox')).toBe('root');
  });
});

describe('inboxItems', () => {
  it('returns inbox children in order, regardless of status', () => {
    const doc = workspace(
      [node('a', { status: 'BACKLOG' }), node('b', { status: 'NEXT' })],
      (d) => {
        addChild(d, 'inbox', 'a');
        addChild(d, 'inbox', 'b');
      },
    );
    expect(ids(inboxItems(doc))).toEqual(['a', 'b']);
  });

  it('is empty when the inbox has no children', () => {
    expect(inboxItems(workspace())).toEqual([]);
  });

  it('skips dangling child ids', () => {
    const doc = workspace([], (d) => addChild(d, 'inbox', 'ghost'));
    expect(inboxItems(doc)).toEqual([]);
  });
});

describe('nextActions', () => {
  const statuses: NodeStatus[] = ['BACKLOG', 'DONE', 'CANCELLED', 'ARCHIVED'];

  it('includes NEXT non-project nodes from anywhere in the tree', () => {
    const doc = workspace(
      [node('a', { status: 'NEXT' }), node('p', { project: true }), node('sub', { status: 'NEXT' })],
      (d) => {
        addChild(d, 'actions', 'a');
        addChild(d, 'projects', 'p');
        addChild(d, 'p', 'sub');
      },
    );
    expect(ids(nextActions(doc)).sort()).toEqual(['a', 'sub']);
  });

  it('excludes projects even when status is NEXT', () => {
    const doc = workspace([node('p', { status: 'NEXT', project: true })], (d) => addChild(d, 'projects', 'p'));
    expect(nextActions(doc)).toEqual([]);
  });

  it.each(statuses)('excludes nodes with status %s', (status) => {
    const doc = workspace([node('a', { status })], (d) => addChild(d, 'actions', 'a'));
    expect(nextActions(doc)).toEqual([]);
  });

  it('never includes structural nodes', () => {
    const doc = workspace((Object.values(workspace().nodes)).map((n) => ({ ...n, status: 'NEXT' as const })));
    expect(ids(nextActions(doc))).not.toContain('inbox');
    expect(ids(nextActions(doc))).not.toContain('root');
  });
});

describe('backlogItems', () => {
  it('includes BACKLOG non-project nodes not under the inbox', () => {
    const doc = workspace([node('a', { status: 'BACKLOG' })], (d) => addChild(d, 'actions', 'a'));
    expect(ids(backlogItems(doc))).toEqual(['a']);
  });

  it('excludes unprocessed inbox items even when BACKLOG', () => {
    const doc = workspace([node('i', { status: 'BACKLOG' })], (d) => addChild(d, 'inbox', 'i'));
    expect(backlogItems(doc)).toEqual([]);
  });

  it('excludes projects and NEXT items', () => {
    const doc = workspace(
      [node('p', { status: 'BACKLOG', project: true }), node('n', { status: 'NEXT' })],
      (d) => {
        addChild(d, 'projects', 'p');
        addChild(d, 'actions', 'n');
      },
    );
    expect(backlogItems(doc)).toEqual([]);
  });
});
