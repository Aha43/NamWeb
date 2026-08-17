import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { backlogItems, blockedGroups, contextItems, dueGroups, nextActions, somedayRoots, somedaySuppressedIds } from './lenses';
import { dayActions } from './calendar';
import { goneQuiet, stalledProjects } from './review';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'NEXT', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function workspace(extra: NamNode[]): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {
    root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    inbox: node('inbox'), projects: node('projects'), actions: node('actions'),
  };
  for (const n of extra) nodes[n.id] = n;
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const OLD = new Date('2026-01-01T00:00:00').toISOString(); // well past the 14-day gone-quiet cutoff

/**
 * A tree exercising SOMEDAY (#1131):
 * - `someday` (SOMEDAY project) → `sa` (NEXT action) + `subp` (sub-project) → `sb` (BACKLOG action)
 * - `normal` (project) → `na` (NEXT) + `nb` (BACKLOG)
 * - `stalledp` (project) → `sta` (BACKLOG only → genuinely stalled)
 * - `arch` (ARCHIVED project) → `asd` (SOMEDAY sub-project) — SOMEDAY *under* ARCHIVED
 */
function tree(): WorkspaceDocument {
  const doc = workspace([
    node('someday', { title: 'Someday proj', project: true, status: 'SOMEDAY', childIds: ['sa', 'subp'] }),
    node('sa', { title: 'Someday next', status: 'NEXT', updatedAt: OLD }),
    node('subp', { title: 'Someday sub', project: true, status: 'NEXT', childIds: ['sb'] }),
    node('sb', { title: 'Someday backlog', status: 'BACKLOG' }),
    node('normal', { title: 'Normal proj', project: true, childIds: ['na', 'nb'] }),
    node('na', { title: 'Normal next', status: 'NEXT', updatedAt: OLD }),
    node('nb', { title: 'Normal backlog', status: 'BACKLOG' }),
    node('stalledp', { title: 'Stalled proj', project: true, childIds: ['sta'] }),
    node('sta', { title: 'Stalled backlog', status: 'BACKLOG' }),
    node('arch', { title: 'Archived proj', project: true, status: 'ARCHIVED', childIds: ['asd'] }),
    node('asd', { title: 'Archived someday', project: true, status: 'SOMEDAY' }),
  ]);
  doc.nodes['projects'].childIds.push('someday', 'normal', 'stalledp', 'arch');
  return doc;
}

describe('SOMEDAY suppression (#1131)', () => {
  it('somedaySuppressedIds = every SOMEDAY node and its descendants (for exclusion)', () => {
    const ids = somedaySuppressedIds(tree());
    // The `someday` subtree, plus `asd` (itself SOMEDAY, though archived-covered) — all excluded from
    // day-to-day views. `somedayRoots` is what filters `asd` out for the *review* surface, not this set.
    expect([...ids].sort()).toEqual(['asd', 'sa', 'sb', 'someday', 'subp'].sort());
  });

  it('a NEXT action under a SOMEDAY project drops out of nextActions (inheritance)', () => {
    expect(nextActions(tree()).map((n) => n.title)).toEqual(['Normal next']); // 'Someday next' excluded
  });

  it('a BACKLOG action under a SOMEDAY project drops out of backlogItems', () => {
    expect(backlogItems(tree()).map((n) => n.title).sort()).toEqual(['Normal backlog', 'Stalled backlog']);
  });

  it('someday-suppressed actions drop out of context/tag views', () => {
    const doc = tree();
    doc.nodes['sa'].tags = ['x'];
    doc.nodes['na'].tags = ['x'];
    expect(contextItems(doc, ['x']).map((n) => n.title)).toEqual(['Normal next']); // 'Someday next' excluded
  });

  it('a SOMEDAY project is not flagged as stalled, but genuine stalls still are', () => {
    const titles = stalledProjects(tree()).map((n) => n.title);
    expect(titles).toContain('Stalled proj');
    expect(titles).not.toContain('Someday proj');
    expect(titles).not.toContain('Someday sub'); // its sub-project too
  });

  it('someday-suppressed actions drop out of gone-quiet', () => {
    const titles = goneQuiet(tree(), new Date('2026-07-23T12:00:00')).map((n) => n.title);
    expect(titles).toContain('Normal next'); // old + open → quiet
    expect(titles).not.toContain('Someday next'); // old but someday-suppressed
  });
});

describe('somedayRoots (#1131 review)', () => {
  it('returns the outermost SOMEDAY node only — one row per parked subtree, not descendants', () => {
    expect(somedayRoots(tree()).map((n) => n.title)).toEqual(['Someday proj']);
  });

  it('ARCHIVED wins — a SOMEDAY node inside an archived subtree is not a someday root', () => {
    // `asd` is SOMEDAY but under the ARCHIVED `arch`; it must not surface for review.
    expect(somedayRoots(tree()).map((n) => n.id)).not.toContain('asd');
  });

  it('a SOMEDAY node nested under another SOMEDAY is collapsed into the outer root', () => {
    const doc = tree();
    doc.nodes['subp'].status = 'SOMEDAY'; // now someday under someday
    expect(somedayRoots(doc).map((n) => n.title)).toEqual(['Someday proj']); // still one row
  });
});

describe('SOMEDAY suppression on the time surfaces (#1137)', () => {
  // A parked item is commitment-less: even carrying a due date or a blocker, it must leave Due, the
  // calendar/agenda, and Blocked — otherwise "someday" keeps nagging from the time surfaces. The
  // normal action gets the same date/blocker as a control, so each test proves suppression, not absence.
  function timed(): WorkspaceDocument {
    const doc = tree();
    doc.nodes['sa'].dueAt = '2026-07-20'; // the SOMEDAY action, now dated
    doc.nodes['na'].dueAt = '2026-07-20'; // a normal dated action (control)
    doc.nodes['sa'].blockedBy = ['nb']; // the SOMEDAY action, blocked by a live node
    doc.nodes['na'].blockedBy = ['nb']; // a normal blocked action (control)
    return doc;
  }

  it('a dated SOMEDAY action drops out of dueGroups', () => {
    const titles = Object.values(dueGroups(timed())).flat().map((n) => n.title);
    expect(titles).toContain('Normal next');
    expect(titles).not.toContain('Someday next');
  });

  it('a dated SOMEDAY action drops out of the calendar grid (dayActions)', () => {
    const titles = dayActions(timed(), '2026-07-20').map((n) => n.title);
    expect(titles).toContain('Normal next');
    expect(titles).not.toContain('Someday next');
  });

  it('a blocked SOMEDAY action drops out of blockedGroups', () => {
    const titles = blockedGroups(timed()).flatMap((g) => g.actions.map((a) => a.title));
    expect(titles).toContain('Normal next');
    expect(titles).not.toContain('Someday next');
  });
});
