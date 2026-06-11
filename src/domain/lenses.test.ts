import { describe, expect, it } from 'vitest';
import type { NamNode, NodeStatus, WorkspaceDocument } from './types';
import {
  backlogItems,
  buildParentIndex,
  buildPath,
  doneItems,
  dueGroups,
  effectiveTags,
  inboxItems,
  nextActions,
  projectPath,
  projects,
  structuralNodeIds,
} from './lenses';

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

describe('projects', () => {
  it('returns the project children directly under the projects node', () => {
    const doc = workspace(
      [node('p1', { project: true }), node('p2', { project: true }), node('loose')],
      (d) => {
        addChild(d, 'projects', 'p1');
        addChild(d, 'projects', 'p2');
        addChild(d, 'projects', 'loose'); // not a project — excluded
      },
    );
    expect(ids(projects(doc))).toEqual(['p1', 'p2']);
  });
});

describe('buildPath / effectiveTags', () => {
  // projects/p1[home] / p2[kitchen] / a[urgent]
  function nested(): WorkspaceDocument {
    return workspace(
      [
        node('p1', { project: true, tags: ['home'], childIds: ['p2'] }),
        node('p2', { project: true, tags: ['kitchen'], childIds: ['a'] }),
        node('a', { status: 'NEXT', tags: ['urgent'] }),
      ],
      (d) => addChild(d, 'projects', 'p1'),
    );
  }

  it('buildPath returns the ancestor project chain, top-most first', () => {
    expect(ids(buildPath(nested(), 'a'))).toEqual(['p1', 'p2']);
    expect(projectPath(nested(), 'a')).toEqual(['p1', 'p2']);
    expect(buildPath(nested(), 'p1')).toEqual([]);
  });

  it('effectiveTags unions own tags with inherited ancestor tags (own first)', () => {
    expect(effectiveTags(nested(), 'a')).toEqual(['urgent', 'home', 'kitchen']);
    expect(effectiveTags(nested(), 'p2')).toEqual(['kitchen', 'home']);
  });
});

describe('dueGroups', () => {
  it('buckets non-done due actions by urgency', () => {
    const now = new Date(2026, 5, 11); // 2026-06-11
    const doc = workspace(
      [
        node('o', { status: 'NEXT', dueAt: '2026-06-01' }),
        node('t', { status: 'NEXT', dueAt: '2026-06-11' }),
        node('w', { status: 'NEXT', dueAt: '2026-06-14' }),
        node('l', { status: 'NEXT', dueAt: '2026-08-01' }),
        node('done', { status: 'DONE', dueAt: '2026-06-01' }), // excluded
      ],
      (d) => ['o', 't', 'w', 'l', 'done'].forEach((id) => addChild(d, 'actions', id)),
    );
    const g = dueGroups(doc, now);
    expect(ids(g.overdue)).toEqual(['o']);
    expect(ids(g.today)).toEqual(['t']);
    expect(ids(g.thisWeek)).toEqual(['w']);
    expect(ids(g.later)).toEqual(['l']);
  });
});

describe('doneItems', () => {
  it('returns DONE non-project actions', () => {
    const doc = workspace(
      [node('d', { status: 'DONE' }), node('n', { status: 'NEXT' }), node('dp', { status: 'DONE', project: true })],
      (d) => {
        addChild(d, 'actions', 'd');
        addChild(d, 'actions', 'n');
        addChild(d, 'projects', 'dp');
      },
    );
    expect(ids(doneItems(doc))).toEqual(['d']);
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

describe('projectPath', () => {
  it('is empty for an action directly under a structural container', () => {
    const doc = workspace([node('a', { status: 'NEXT' })], (d) => addChild(d, 'actions', 'a'));
    expect(projectPath(doc, 'a')).toEqual([]);
  });

  it('lists the parent project for an action under a project', () => {
    const doc = workspace(
      [node('home', { project: true, title: 'Home' }), node('a', { status: 'NEXT' })],
      (d) => {
        addChild(d, 'projects', 'home');
        addChild(d, 'home', 'a');
      },
    );
    expect(projectPath(doc, 'a')).toEqual(['Home']);
  });

  it('lists ancestors top-most first for a nested sub-project', () => {
    const doc = workspace(
      [
        node('home', { project: true, title: 'Home' }),
        node('kitchen', { project: true, title: 'Kitchen' }),
        node('a', { status: 'NEXT' }),
      ],
      (d) => {
        addChild(d, 'projects', 'home');
        addChild(d, 'home', 'kitchen');
        addChild(d, 'kitchen', 'a');
      },
    );
    expect(projectPath(doc, 'a')).toEqual(['Home', 'Kitchen']);
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
