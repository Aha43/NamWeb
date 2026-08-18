import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import {
  backlogItems,
  blockedGroups,
  checklistSuppressedIds,
  contextItems,
  dueGroups,
  nextActions,
  projects,
} from './lenses';
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
 * A tree exercising #checklist (#1147):
 * - `list` (#checklist project, NEXT) → `c1` (NEXT check-item, tag ctx), `c2` (BACKLOG, dated + blocked),
 *   `c3` (DONE) — the project keeps its status; its items are suppressed everywhere.
 * - `emptylist` (#checklist project, NEXT) → `e1` (BACKLOG) — no open next, yet NOT stalled.
 * - `normal` (project) → `na` (NEXT, dated), `nb` (BACKLOG, blocked) — the controls that stay visible.
 * - `stalledp` (project) → `sta` (BACKLOG only) — genuinely stalled.
 */
function tree(): WorkspaceDocument {
  const doc = workspace([
    node('list', { title: 'Checklist', project: true, status: 'NEXT', tags: ['#checklist'], childIds: ['c1', 'c2', 'c3'] }),
    node('c1', { title: 'Check one', status: 'NEXT', tags: ['ctx'], updatedAt: OLD }),
    node('c2', { title: 'Check two', status: 'BACKLOG', dueAt: '2026-07-20', blockedBy: ['na'] }),
    node('c3', { title: 'Check three', status: 'DONE' }),
    node('emptylist', { title: 'Empty checklist', project: true, status: 'NEXT', tags: ['#checklist'], childIds: ['e1'] }),
    node('e1', { title: 'Lonely item', status: 'BACKLOG' }),
    node('normal', { title: 'Normal proj', project: true, childIds: ['na', 'nb'] }),
    node('na', { title: 'Normal next', status: 'NEXT', dueAt: '2026-07-20', tags: ['ctx'], updatedAt: OLD }),
    node('nb', { title: 'Normal blocked', status: 'BACKLOG', blockedBy: ['na'] }),
    node('stalledp', { title: 'Stalled proj', project: true, childIds: ['sta'] }),
    node('sta', { title: 'Stalled backlog', status: 'BACKLOG' }),
  ]);
  doc.nodes['projects'].childIds.push('list', 'emptylist', 'normal', 'stalledp');
  return doc;
}

describe('#checklist suppression (#1147)', () => {
  it('checklistSuppressedIds = the check-items (descendants) but NOT the checklist project itself', () => {
    expect([...checklistSuppressedIds(tree())].sort()).toEqual(['c1', 'c2', 'c3', 'e1'].sort());
  });

  it('the checklist project stays visible in the projects list', () => {
    const titles = projects(tree()).map((n) => n.title);
    expect(titles).toContain('Checklist');
    expect(titles).toContain('Empty checklist');
  });

  it('a NEXT check-item drops out of nextActions', () => {
    expect(nextActions(tree()).map((n) => n.title)).toEqual(['Normal next']); // 'Check one' excluded
  });

  it('a BACKLOG check-item drops out of backlogItems', () => {
    expect(backlogItems(tree()).map((n) => n.title).sort()).toEqual(['Normal blocked', 'Stalled backlog']);
  });

  it('check-items drop out of context/tag views', () => {
    expect(contextItems(tree(), ['ctx']).map((n) => n.title)).toEqual(['Normal next']); // 'Check one' excluded
  });

  it('a dated check-item drops out of dueGroups (the control stays)', () => {
    const titles = Object.values(dueGroups(tree())).flat().map((n) => n.title);
    expect(titles).toContain('Normal next');
    expect(titles).not.toContain('Check two');
  });

  it('a dated check-item drops out of the calendar grid', () => {
    const titles = dayActions(tree(), '2026-07-20').map((n) => n.title);
    expect(titles).toContain('Normal next');
    expect(titles).not.toContain('Check two');
  });

  it('a blocked check-item drops out of blockedGroups (the control stays)', () => {
    const titles = blockedGroups(tree()).flatMap((g) => g.actions.map((a) => a.title));
    expect(titles).toContain('Normal blocked');
    expect(titles).not.toContain('Check two');
  });

  it('a quiet check-item drops out of gone-quiet', () => {
    const titles = goneQuiet(tree(), new Date('2026-07-23T12:00:00')).map((n) => n.title);
    expect(titles).toContain('Normal next'); // old + open → quiet
    expect(titles).not.toContain('Check one'); // old but a check-item
  });

  it('a checklist project is never flagged stalled — even with no open next — but genuine stalls are', () => {
    const titles = stalledProjects(tree()).map((n) => n.title);
    expect(titles).toContain('Stalled proj');
    expect(titles).not.toContain('Checklist');
    expect(titles).not.toContain('Empty checklist'); // no open next, yet a checklist, so not stalled
  });
});
