import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { focusCards } from './focusCards';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'NEXT', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function doc(): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {
    root: node('root', { project: true, childIds: ['projects'] }),
    projects: node('projects', { project: true, childIds: ['p'] }),
    p: node('p', { project: true, childIds: ['a1', 'a2', 'a3', 'sub'] }),
    a1: node('a1', { title: 'First', status: 'NEXT' }),
    a2: node('a2', { title: 'Done one', status: 'DONE' }),
    a3: node('a3', { title: 'Later', status: 'BACKLOG' }),
    sub: node('sub', { title: 'Sub', project: true }),
  };
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'projects',
    projectsNodeId: 'projects', nextActionsNodeId: 'projects',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

describe('focusCards — project source', () => {
  it("queues a project's open direct actions (excludes done + sub-projects), in order", () => {
    const cards = focusCards(doc(), { project: 'p' });
    expect(cards.map((c) => c.id)).toEqual(['a1', 'a3']);
    expect(cards.map((c) => c.title)).toEqual(['First', 'Later']);
  });
});
