import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { toActionRow } from './rows';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'NEXT', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

// projects/ p[office] / a[urgent]
function doc(): WorkspaceDocument {
  const root = node('root', { childIds: ['inbox', 'projects', 'actions'] });
  const p = node('p', { project: true, tags: ['office'], childIds: ['a'] });
  const a = node('a', { tags: ['urgent'] });
  const nodes: Record<string, NamNode> = {};
  for (const n of [root, node('inbox'), node('projects', { childIds: ['p'] }), node('actions'), p, a]) nodes[n.id] = n;
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects',
    nextActionsNodeId: 'actions', nodes, registeredTags: [], savedViews: [], missionControls: [],
    templates: [], viewOrders: {},
  };
}

describe('toActionRow', () => {
  it('separates own tags from inherited (rubbed-off) project tags', () => {
    const row = toActionRow(doc(), doc().nodes['a']);
    expect(row.tags).toEqual(['urgent']); // own only
    expect(row.inheritedTags).toEqual(['office']); // inherited from the project, not duplicated
  });
});
