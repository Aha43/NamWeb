import { describe, expect, it } from 'vitest';
import type { NamNode, NodeStatus, WorkspaceDocument } from './types';
import {
  actionsWithStatuses,
  allOpenableActions,
  allTags,
  applyViewOrder,
  archivedNodeIds,
  archivedProjectIds,
  backlogItems,
  blockedGroups,
  buildParentIndex,
  buildPath,
  canAddPrerequisite,
  contextItems,
  doneItems,
  dueGroups,
  isBlocked,
  searchResults,
  unblocks,
  effectiveTags,
  inboxItems,
  nextActions,
  projectActions,
  actionMoveTargetsAll,
  projectMoveTargets,
  projectQuickMoveTargets,
  projectPath,
  projects,
  reorderKindWithinChildren,
  structuralNodeIds,
  subProjects,
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

describe('projectMoveTargets', () => {
  // projects/ A[a1] , B / B1 ; move targets exclude self + subtree, siblings first.
  function tree(): WorkspaceDocument {
    return workspace(
      [
        node('A', { project: true, childIds: ['a1'] }),
        node('a1', { project: true }), // sub-project of A
        node('B', { project: true }),
      ],
      (d) => {
        addChild(d, 'projects', 'A');
        addChild(d, 'projects', 'B');
      },
    );
  }

  it('lists top-level siblings first for a top-level project (no Top level entry)', () => {
    const targets = projectMoveTargets(tree(), 'A');
    // A's siblings (top-level) first = B; then deeper = a1's... a1 is in A's subtree → excluded.
    expect(targets.map((t) => t.id)).toEqual(['B']);
    expect(targets.map((t) => t.label)).toEqual(['B']);
  });

  it("offers Top level + same-parent siblings for a nested project, excluding its parent", () => {
    // Give A a second sub-project so a1 has a sibling.
    const doc = tree();
    doc.nodes['A'].childIds.push('a2');
    doc.nodes['a2'] = node('a2', { project: true });
    const targets = projectMoveTargets(doc, 'a1');
    // Top level first, then sibling a2, then other projects (B) — parent A excluded.
    expect(targets[0]).toEqual({ id: 'projects', label: 'Top level' });
    const idsList = targets.map((t) => t.id);
    expect(idsList).toContain('a2');
    expect(idsList).toContain('B');
    expect(idsList).not.toContain('A'); // current parent excluded
    expect(idsList).not.toContain('a1'); // self excluded
    // a2 (sibling) comes before B (other).
    expect(idsList.indexOf('a2')).toBeLessThan(idsList.indexOf('B'));
  });
});

describe('projectQuickMoveTargets', () => {
  // projects/ A[a1, a2] , B
  function tree(): WorkspaceDocument {
    const d = workspace(
      [
        node('A', { project: true, childIds: ['a1', 'a2'] }),
        node('a1', { project: true }),
        node('a2', { project: true }),
        node('B', { project: true }),
      ],
      (doc) => {
        addChild(doc, 'projects', 'A');
        addChild(doc, 'projects', 'B');
      },
    );
    return d;
  }

  it('nested project: Top level + same-parent siblings only (no distant projects)', () => {
    const targets = projectQuickMoveTargets(tree(), 'a1');
    expect(targets[0]).toEqual({ id: 'projects', label: 'Top level', kind: 'toplevel' });
    const idsList = targets.map((t) => t.id);
    expect(idsList).toContain('a2'); // sibling
    expect(idsList).not.toContain('B'); // distant project — only in the full browse set
    expect(idsList).not.toContain('A'); // parent
    expect(idsList).not.toContain('a1'); // self
  });

  it('top-level project: sibling top-level projects only, no Top level entry', () => {
    expect(projectQuickMoveTargets(tree(), 'A').map((t) => t.id)).toEqual(['B']);
  });
});

describe('actionMoveTargetsAll', () => {
  // projects/ A[act1] , B ; archived C — act1 is an action under A.
  function tree(): WorkspaceDocument {
    return workspace(
      [
        node('A', { project: true, childIds: ['act1'] }),
        node('act1', { project: false }),
        node('B', { project: true }),
        node('C', { project: true, status: 'ARCHIVED' }),
      ],
      (d) => {
        addChild(d, 'projects', 'A');
        addChild(d, 'projects', 'B');
        addChild(d, 'projects', 'C');
      },
    );
  }

  it('offers Free actions + every non-archived project (browse superset)', () => {
    const idsList = actionMoveTargetsAll(tree(), 'act1').map((t) => t.id);
    expect(idsList[0]).toBe('actions'); // Free actions first
    expect(idsList).toContain('A'); // including the action's own current project
    expect(idsList).toContain('B');
    expect(idsList).not.toContain('C'); // archived excluded
  });

  it('returns nothing for a project (actions only)', () => {
    expect(actionMoveTargetsAll(tree(), 'A')).toEqual([]);
  });
});

describe('archivedProjectIds', () => {
  // projects/ Old(ARCHIVED)[sub(NEXT)] , Live ; archiving is set on the top project only.
  function tree(): WorkspaceDocument {
    return workspace(
      [
        node('Old', { project: true, status: 'ARCHIVED', childIds: ['sub'] }),
        node('sub', { project: true, status: 'NEXT' }), // sub-project keeps its own status
        node('Live', { project: true }),
      ],
      (d) => {
        addChild(d, 'projects', 'Old');
        addChild(d, 'projects', 'Live');
      },
    );
  }

  it('includes a directly-archived top project and its sub-projects (transitive), not live ones', () => {
    const archived = archivedProjectIds(tree());
    expect(archived.has('Old')).toBe(true);
    expect(archived.has('sub')).toBe(true); // archived via ancestor, despite its own NEXT status
    expect(archived.has('Live')).toBe(false);
  });

  it('excludes archived projects (and their sub-projects) from move targets', () => {
    const targets = projectMoveTargets(tree(), 'Live');
    // Only the archived top project and its sub-project exist besides Live → no valid targets.
    expect(targets.map((t) => t.id)).toEqual([]);
  });
});

describe('archivedNodeIds — archived actions stay out of the action views', () => {
  // projects/ Old(ARCHIVED)[oa(NEXT), ob(BACKLOG), od(DONE)] ; actions/ la(NEXT), lb(BACKLOG)
  function tree(): WorkspaceDocument {
    return workspace(
      [
        node('Old', { project: true, status: 'ARCHIVED', childIds: ['oa', 'ob', 'od'] }),
        node('oa', { status: 'NEXT' }),
        node('ob', { status: 'BACKLOG' }),
        node('od', { status: 'DONE' }),
        node('la', { status: 'NEXT' }),
        node('lb', { status: 'BACKLOG' }),
      ],
      (d) => {
        addChild(d, 'projects', 'Old');
        addChild(d, 'actions', 'la');
        addChild(d, 'actions', 'lb');
      },
    );
  }

  it('archivedNodeIds covers an archived project and all its descendants', () => {
    const archived = archivedNodeIds(tree());
    expect(archived.has('Old')).toBe(true);
    expect(archived.has('oa')).toBe(true);
    expect(archived.has('ob')).toBe(true);
    expect(archived.has('od')).toBe(true);
    expect(archived.has('la')).toBe(false);
  });

  it('nextActions and backlogItems exclude actions inside an archived project', () => {
    const doc = tree();
    expect(ids(nextActions(doc))).toEqual(['la']); // not oa
    expect(ids(backlogItems(doc))).toEqual(['lb']); // not ob
  });

  it('doneItems excludes archived done actions too', () => {
    expect(ids(doneItems(tree()))).toEqual([]); // od is archived
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

describe('prerequisites / blocked', () => {
  // a blocked by b; b blocked by c
  function chain() {
    return workspace(
      [
        node('a', { status: 'NEXT', blockedBy: ['b'] }),
        node('b', { status: 'NEXT', blockedBy: ['c'] }),
        node('c', { status: 'NEXT' }),
      ],
      (d) => ['a', 'b', 'c'].forEach((id) => addChild(d, 'actions', id)),
    );
  }

  it('isBlocked reflects non-DONE prerequisites', () => {
    const doc = chain();
    expect(isBlocked(doc, 'a')).toBe(true);
    doc.nodes['b'].status = 'DONE';
    expect(isBlocked(doc, 'a')).toBe(false); // its only blocker is done
    expect(isBlocked(doc, 'c')).toBe(false); // no blockers
  });

  it('canAddPrerequisite rejects self, duplicates, and cycles', () => {
    const doc = chain();
    expect(canAddPrerequisite(doc, 'a', 'a')).toBe(false); // self
    expect(canAddPrerequisite(doc, 'a', 'b')).toBe(false); // duplicate
    expect(canAddPrerequisite(doc, 'c', 'a')).toBe(false); // cycle: a→b→c, so c→a closes it
    expect(canAddPrerequisite(doc, 'a', 'c')).toBe(true); // fine
  });

  it('blockedGroups groups blocked actions by active blocker; unblocks is the inverse', () => {
    const doc = chain();
    const groups = blockedGroups(doc);
    expect(groups.map((g) => g.blocker.id).sort()).toEqual(['b', 'c']);
    const byB = groups.find((g) => g.blocker.id === 'b')!;
    expect(ids(byB.actions)).toEqual(['a']);
    expect(ids(unblocks(doc, 'b'))).toEqual(['a']);
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
        node('cancelled', { status: 'CANCELLED', dueAt: '2026-06-01' }), // excluded — agrees with the calendar (#694)
      ],
      (d) => ['o', 't', 'w', 'l', 'done', 'cancelled'].forEach((id) => addChild(d, 'actions', id)),
    );
    const g = dueGroups(doc, now);
    expect(ids(g.overdue)).toEqual(['o']);
    expect(ids(g.today)).toEqual(['t']);
    expect(ids(g.thisWeek)).toEqual(['w']);
    expect(ids(g.later)).toEqual(['l']);
  });
});

describe('tags & search', () => {
  // projects/p1[home] / a[urgent](NEXT), b[home](BACKLOG, done? no), d[urgent](DONE)
  function tagged() {
    return workspace(
      [
        node('p1', { project: true, tags: ['home'], childIds: ['a', 'b', 'd'] }),
        node('a', { title: 'Fix tap', status: 'NEXT', tags: ['urgent'] }),
        node('b', { title: 'Buy paint', status: 'BACKLOG' }),
        node('d', { title: 'Old', status: 'DONE', tags: ['urgent'] }),
      ],
      (w) => addChild(w, 'projects', 'p1'),
    );
  }

  it('allTags is the sorted union of node + registered tags — plus the system tags (#651)', () => {
    const doc = tagged();
    doc.registeredTags = ['waiting'];
    expect(allTags(doc)).toEqual(['#in-progress', '#shared-hide', 'home', 'urgent', 'waiting']);
  });

  it('allTags collapses NamDesktop-cased system-tag variants into the canonical form (#654)', () => {
    const doc = tagged();
    doc.nodes['a'].tags.push('In Progress'); // desktop-written case variant
    const tags = allTags(doc);
    expect(tags).toContain('#in-progress');
    expect(tags).not.toContain('In Progress');
    expect(tags).not.toContain('in progress'); // legacy spelling canonicalizes to the sigil form
  });

  it('contextItems matches tags case-insensitively (#654)', () => {
    const doc = tagged();
    doc.nodes['a'].tags.push('In Progress');
    expect(ids(contextItems(doc, ['in progress']))).toContain('a');
  });

  it('contextItems AND-matches effective tags, excludes done, honours nextOnly', () => {
    const doc = tagged();
    // 'home' is inherited by all of p1's children; 'a' and 'b' qualify (d is DONE)
    expect(ids(contextItems(doc, ['home'])).sort()).toEqual(['a', 'b']);
    // 'home' + 'urgent' → only 'a' (own urgent + inherited home)
    expect(ids(contextItems(doc, ['home', 'urgent']))).toEqual(['a']);
    // nextOnly drops the BACKLOG 'b'
    expect(ids(contextItems(doc, ['home'], true))).toEqual(['a']);
  });

  it('searchResults matches titles/tags case-insensitively, excludes done', () => {
    const doc = tagged();
    expect(searchResults(doc, 'fix').map((r) => r.node.id)).toEqual(['a']);
    expect(searchResults(doc, 'URGENT').map((r) => r.node.id)).toEqual(['a']); // d is DONE
    expect(searchResults(doc, '')).toEqual([]);
  });

  it('searchResults matches inherited (rubbed-off) project tags too', () => {
    const doc = tagged();
    // 'home' lives on p1; a and b inherit it → all three match (d is DONE, excluded).
    expect(searchResults(doc, 'home').map((r) => r.node.id).sort()).toEqual(['a', 'b', 'p1']);
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

describe('projectActions / subProjects', () => {
  const doc = workspace([
    node('p', { title: 'P', project: true, childIds: ['a1', 'sp1', 'a2', 'sp2'] }),
    node('a1', { project: false }),
    node('sp1', { project: true }),
    node('a2', { project: false }),
    node('sp2', { project: true }),
  ]);

  it('returns direct actions in childIds order', () => {
    expect(projectActions(doc, 'p').map((n) => n.id)).toEqual(['a1', 'a2']);
  });

  it('returns direct sub-projects in childIds order', () => {
    expect(subProjects(doc, 'p').map((n) => n.id)).toEqual(['sp1', 'sp2']);
  });

  it('is empty for an unknown node', () => {
    expect(projectActions(doc, 'ghost')).toEqual([]);
    expect(subProjects(doc, 'ghost')).toEqual([]);
  });
});

describe('reorderKindWithinChildren', () => {
  // childIds interleave two kinds: actions a1/a2 and sub-projects sp1/sp2.
  const childIds = ['a1', 'sp1', 'a2', 'sp2'];

  it('reorders one kind while the other kind keeps its slots', () => {
    // Reverse the actions; sub-projects stay at indices 1 and 3.
    expect(reorderKindWithinChildren(childIds, ['a2', 'a1'])).toEqual(['a2', 'sp1', 'a1', 'sp2']);
    // Reverse the sub-projects; actions stay at indices 0 and 2.
    expect(reorderKindWithinChildren(childIds, ['sp2', 'sp1'])).toEqual(['a1', 'sp2', 'a2', 'sp1']);
  });

  it('is a no-op when the new order is already the current order', () => {
    expect(reorderKindWithinChildren(childIds, ['a1', 'a2'])).toEqual(childIds);
  });

  it('returns the original childIds if any id is not a current child (ignores stale input)', () => {
    expect(reorderKindWithinChildren(childIds, ['a1', 'ghost'])).toEqual(childIds);
  });
});

describe('applyViewOrder', () => {
  const ids = (nodes: NamNode[]) => nodes.map((n) => n.id);
  const list = [node('a'), node('b'), node('c')];

  it('returns the input order when no saved order exists', () => {
    expect(ids(applyViewOrder(list, undefined))).toEqual(['a', 'b', 'c']);
    expect(ids(applyViewOrder(list, []))).toEqual(['a', 'b', 'c']);
  });

  it('orders known ids by the saved order', () => {
    expect(ids(applyViewOrder(list, ['c', 'a', 'b']))).toEqual(['c', 'a', 'b']);
  });

  it('appends new items (not yet in the order) after the known ones', () => {
    expect(ids(applyViewOrder(list, ['b', 'a']))).toEqual(['b', 'a', 'c']);
  });

  it('ignores saved ids that are no longer present', () => {
    expect(ids(applyViewOrder(list, ['gone', 'c', 'a', 'b']))).toEqual(['c', 'a', 'b']);
  });
});

describe('allOpenableActions (#735)', () => {
  it('lists exactly what the browser columns can reach — inbox and nested-under-action excluded', () => {
    const doc = workspace(
      [
        node('p1', { title: 'Home', project: true, childIds: ['a1', 'done1'] }),
        node('a1', { title: 'Fix door', status: 'NEXT' }),
        node('done1', { title: 'Painted', status: 'DONE' }),
        node('free1', { title: 'Call plumber', status: 'NEXT' }),
        node('cap1', { title: 'Unclarified thought' }),
        node('sub1', { title: 'Sub-action of an action' }),
        node('arch', { title: 'Archived', project: true, status: 'ARCHIVED' as NodeStatus, childIds: ['a2'] }),
        node('a2', { title: 'Buried', status: 'NEXT' }),
      ],
      (doc) => {
        doc.nodes['projects'].childIds = ['p1', 'arch'];
        doc.nodes['actions'].childIds = ['free1'];
        doc.nodes['inbox'].childIds = ['cap1'];
        doc.nodes['a1'].childIds = ['sub1'];
      },
    );
    const ids = allOpenableActions(doc).map((t) => t.id).sort();
    // In: an open action under a project, and a free action. Out: DONE, the inbox capture
    // (no Inbox column to reach it), a sub-action of an action (not drilled into), archived.
    expect(ids).toEqual(['a1', 'free1']);
  });
});

describe('status-box lenses (#766)', () => {
  it('actionsWithStatuses unions per-status semantics; dueGroups/contextItems admit done on request', () => {
    const doc = workspace(
      [
        node('p1', { title: 'Home', project: true, childIds: ['n1', 'd1'] }),
        node('n1', { status: 'NEXT', tags: ['home'], dueAt: '2020-01-01' }),
        node('d1', { status: 'DONE', tags: ['home'], dueAt: '2020-01-01' }),
        node('b1', { status: 'BACKLOG' }),
        node('cap', {}), // inbox capture: BACKLOG status but NOT backlog-view material
      ],
      (doc) => {
        doc.nodes['projects'].childIds = ['p1'];
        doc.nodes['actions'].childIds = ['b1'];
        doc.nodes['inbox'].childIds = ['cap'];
      },
    );
    expect(actionsWithStatuses(doc, ['NEXT']).map((n) => n.id)).toEqual(['n1']);
    expect(actionsWithStatuses(doc, ['NEXT', 'BACKLOG']).map((n) => n.id).sort()).toEqual(['b1', 'n1']);
    expect(actionsWithStatuses(doc, ['NEXT', 'BACKLOG', 'DONE']).map((n) => n.id).sort()).toEqual(['b1', 'd1', 'n1']);
    // Each status keeps its own view's rules: the inbox capture never leaks into Backlog.
    expect(actionsWithStatuses(doc, ['BACKLOG']).map((n) => n.id)).toEqual(['b1']);

    // Due: done items join only when asked.
    expect(dueGroups(doc).overdue.map((n) => n.id)).toEqual(['n1']);
    expect(dueGroups(doc, new Date(), true).overdue.map((n) => n.id).sort()).toEqual(['d1', 'n1']);

    // Contexts: same opt-in.
    expect(contextItems(doc, ['home']).map((n) => n.id)).toEqual(['n1']);
    expect(contextItems(doc, ['home'], false, true).map((n) => n.id).sort()).toEqual(['d1', 'n1']);
  });
});
