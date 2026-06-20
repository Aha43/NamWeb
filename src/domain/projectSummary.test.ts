import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { projectSummaryMarkdown } from './projectSummary';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

function workspace(extra: NamNode[]): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {};
  for (const n of extra) nodes[n.id] = n;
  return {
    formatVersion: 1, rootNodeId: 'r', inboxNodeId: 'i', projectsNodeId: 'pj', nextActionsNodeId: 'ac',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

describe('projectSummaryMarkdown', () => {
  it('renders the project as # and each action as a heading + description paragraph', () => {
    const doc = workspace([
      node('p', { project: true, title: 'Kitchen reno', description: 'Redo the kitchen.', childIds: ['a1', 'a2'] }),
      node('a1', { title: 'Buy tiles', description: 'Matte finish, ~12 m².' }),
      node('a2', { title: 'Measure the floor' }), // no description → heading only
    ]);
    expect(projectSummaryMarkdown(doc, 'p')).toBe(
      [
        '# Kitchen reno',
        'Redo the kitchen.',
        '## Buy tiles',
        'Matte finish, ~12 m².',
        '## Measure the floor',
      ].join('\n\n') + '\n',
    );
  });

  it('nests sub-projects a level deeper, listing actions before sub-projects', () => {
    const doc = workspace([
      node('p', { project: true, title: 'P', childIds: ['a1', 'sub'] }),
      node('a1', { title: 'Direct action' }),
      node('sub', { project: true, title: 'Phase 2', childIds: ['b1'] }),
      node('b1', { title: 'Nested action' }),
    ]);
    expect(projectSummaryMarkdown(doc, 'p')).toBe(
      ['# P', '## Direct action', '## Phase 2', '### Nested action'].join('\n\n') + '\n',
    );
  });

  it("includes an action's tags as an italic line under its heading", () => {
    const doc = workspace([
      node('p', { project: true, title: 'P', childIds: ['a'] }),
      node('a', { title: 'Tagged', tags: ['shopping', 'home'], description: 'Buy stuff.' }),
    ]);
    expect(projectSummaryMarkdown(doc, 'p')).toBe(
      ['# P', '## Tagged', '_Tags: shopping, home_', 'Buy stuff.'].join('\n\n') + '\n',
    );
  });

  it('filters actions by status and prunes sub-projects with no matching actions', () => {
    const doc = workspace([
      node('p', { project: true, title: 'P', childIds: ['a1', 'a2', 'sub'] }),
      node('a1', { title: 'Do now', status: 'NEXT' }),
      node('a2', { title: 'Finished', status: 'DONE' }),
      node('sub', { project: true, title: 'All done', childIds: ['b1'] }),
      node('b1', { title: 'Old', status: 'DONE' }),
    ]);
    // Next + Backlog only: the DONE action is excluded and the all-DONE sub-project is pruned.
    expect(projectSummaryMarkdown(doc, 'p', { statuses: ['NEXT', 'BACKLOG'] })).toBe(
      ['# P', '## Do now'].join('\n\n') + '\n',
    );
    // Including DONE brings them back (sub-project no longer pruned).
    expect(projectSummaryMarkdown(doc, 'p', { statuses: ['NEXT', 'BACKLOG', 'DONE'] })).toBe(
      ['# P', '## Do now', '## Finished', '## All done', '### Old'].join('\n\n') + '\n',
    );
  });

  it('omits sub-projects entirely when includeSubProjects is false', () => {
    const doc = workspace([
      node('p', { project: true, title: 'P', childIds: ['a1', 'sub'] }),
      node('a1', { title: 'Direct action' }),
      node('sub', { project: true, title: 'Phase 2', childIds: ['b1'] }),
      node('b1', { title: 'Nested action' }),
    ]);
    expect(projectSummaryMarkdown(doc, 'p', { includeSubProjects: false })).toBe(
      ['# P', '## Direct action'].join('\n\n') + '\n',
    );
  });

  it('returns empty string for a missing project', () => {
    expect(projectSummaryMarkdown(workspace([]), 'ghost')).toBe('');
  });
});
