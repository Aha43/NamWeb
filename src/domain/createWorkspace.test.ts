import { describe, expect, it } from 'vitest';
import { createDefaultWorkspace } from './createWorkspace';

describe('createDefaultWorkspace', () => {
  it('builds a desktop-compatible empty document (root NAM + Inbox/Projects/Actions)', () => {
    const doc = createDefaultWorkspace();

    expect(doc.formatVersion).toBe(1);
    expect(Object.keys(doc.nodes)).toHaveLength(4);

    const root = doc.nodes[doc.rootNodeId];
    expect(root.title).toBe('NAM');
    // Root holds the three fixed buckets, in order.
    expect(root.childIds).toEqual([doc.inboxNodeId, doc.projectsNodeId, doc.nextActionsNodeId]);

    expect(doc.nodes[doc.inboxNodeId].title).toBe('Inbox');
    expect(doc.nodes[doc.projectsNodeId].title).toBe('Projects');
    expect(doc.nodes[doc.nextActionsNodeId].title).toBe('Actions');
  });

  it('gives every node desktop defaults', () => {
    const doc = createDefaultWorkspace();
    for (const node of Object.values(doc.nodes)) {
      expect(node.status).toBe('BACKLOG');
      expect(node.project).toBe(false);
      expect(node.tags).toEqual([]);
      expect(node.blockedBy).toEqual([]);
      expect(node.resources).toEqual([]);
      expect(node.createdAt).toBeNull();
    }
  });

  it('uses unique ids and is empty of user content', () => {
    const doc = createDefaultWorkspace();
    const ids = new Set([doc.rootNodeId, doc.inboxNodeId, doc.projectsNodeId, doc.nextActionsNodeId]);
    expect(ids.size).toBe(4);
    expect(doc.registeredTags).toEqual([]);
    expect(doc.savedViews).toEqual([]);
    expect(doc.missionControls).toEqual([]);
    expect(doc.templates).toEqual([]);
    expect(doc.viewOrders).toEqual({});
  });

  it('produces a fresh document each call (distinct ids)', () => {
    expect(createDefaultWorkspace().rootNodeId).not.toBe(createDefaultWorkspace().rootNodeId);
  });
});
