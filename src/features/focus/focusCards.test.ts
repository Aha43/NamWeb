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
    a1: node('a1', { title: 'First', status: 'NEXT', tags: ['home'] }),
    a2: node('a2', { title: 'Done one', status: 'DONE', tags: ['home'] }),
    a3: node('a3', { title: 'Later', status: 'BACKLOG', tags: ['home', 'work'] }),
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

describe('focusCards — tag source', () => {
  it('queues active actions matching the tag (excludes done)', () => {
    const cards = focusCards(doc(), { tags: ['home'], nextOnly: false });
    expect(cards.map((c) => c.id)).toEqual(['a1', 'a3']); // a2 is done
  });

  it('respects nextOnly', () => {
    const cards = focusCards(doc(), { tags: ['home'], nextOnly: true });
    expect(cards.map((c) => c.id)).toEqual(['a1']); // a3 is backlog
  });

  it('matches a different tag', () => {
    const cards = focusCards(doc(), { tags: ['work'], nextOnly: false });
    expect(cards.map((c) => c.id)).toEqual(['a3']);
  });
});

describe('focusCards — due source', () => {
  // Date-only, local — matches how dueGroups parses dueAt (focusCards calls dueGroups with today).
  function localDate(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function dueDoc(): WorkspaceDocument {
    const nodes: Record<string, NamNode> = {
      root: node('root', { project: true, childIds: ['inbox', 'projects', 'actions'] }),
      inbox: node('inbox', { project: true }),
      projects: node('projects', { project: true }),
      actions: node('actions', { project: true, childIds: ['overdue', 'today', 'later'] }),
      overdue: node('overdue', { title: 'Overdue', status: 'NEXT', dueAt: localDate(-1) }),
      today: node('today', { title: 'Today', status: 'NEXT', dueAt: localDate(0) }),
      later: node('later', { title: 'Later', status: 'BACKLOG', dueAt: localDate(30) }),
    };
    return {
      formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox',
      projectsNodeId: 'projects', nextActionsNodeId: 'actions',
      nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
    };
  }

  it('queues the due-now set (overdue + today), excluding later', () => {
    const cards = focusCards(dueDoc(), 'due');
    expect(cards.map((c) => c.id)).toEqual(['overdue', 'today']);
  });
});
