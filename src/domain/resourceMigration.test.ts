import { describe, it, expect } from 'vitest';
import { stampResourceIds } from './resourceMigration';
import type { NamNode, Resource, WorkspaceDocument } from './types';

function node(id: string, resources: Resource[]): NamNode {
  return {
    id,
    title: id,
    description: null,
    status: 'BACKLOG',
    project: false,
    childIds: [],
    tags: [],
    blockedBy: [],
    resources,
    createdAt: null,
    updatedAt: null,
    statusChangedAt: null,
    dueAt: null,
  };
}

function doc(nodes: NamNode[]): WorkspaceDocument {
  return {
    formatVersion: 1,
    rootNodeId: 'root',
    inboxNodeId: 'inbox',
    projectsNodeId: 'projects',
    nextActionsNodeId: 'actions',
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    registeredTags: [],
    savedViews: [],
    missionControls: [],
    templates: [],
    viewOrders: {},
  };
}

const uri = (value: string, id?: string): Resource => ({
  ...(id ? { id } : {}),
  type: 'URI',
  value,
  description: null,
});

describe('stampResourceIds (#1195 one-time migration)', () => {
  it('stamps an id onto only the id-less resources, leaving existing ids untouched', () => {
    let n = 0;
    const gen = () => `gen-${++n}`;
    const d = doc([
      node('a', [uri('https://legacy1'), uri('https://kept', 'r-existing')]),
      node('b', [uri('https://legacy2')]),
      node('c', []), // no resources — nothing to do
    ]);

    const stamped = stampResourceIds(d, gen);

    expect(stamped).toBe(2); // the two legacy resources
    expect(d.nodes.a.resources[0].id).toBe('gen-1'); // legacy → stamped
    expect(d.nodes.a.resources[1].id).toBe('r-existing'); // existing id preserved
    expect(d.nodes.b.resources[0].id).toBe('gen-2');
    // value/type/description untouched
    expect(d.nodes.a.resources[0]).toMatchObject({ type: 'URI', value: 'https://legacy1', description: null });
  });

  it('is idempotent — a second run stamps nothing', () => {
    let n = 0;
    const gen = () => `gen-${++n}`;
    const d = doc([node('a', [uri('https://x')])]);

    expect(stampResourceIds(d, gen)).toBe(1);
    expect(stampResourceIds(d, gen)).toBe(0); // all resources now have ids
  });
});
