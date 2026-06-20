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

  it('returns empty string for a missing project', () => {
    expect(projectSummaryMarkdown(workspace([]), 'ghost')).toBe('');
  });
});
