// Intent-based mutations on the workspace document. Each `Intent` is a small,
// named, self-contained operation carrying any locally-generated values (ids,
// timestamps) so it can be *replayed* onto a freshly pulled document during the
// sync conflict-retry. All functions are pure: they return a new document and
// never mutate the input. Mirrors NamDesktop `NamWorkspaceService`.

import type { NamNode, NodeStatus, WorkspaceDocument } from './types';

export type Intent =
  | { type: 'addInboxItem'; id: string; title: string; now: string }
  | { type: 'convertInboxToNext'; id: string; now: string }
  | { type: 'setStatus'; id: string; status: NodeStatus; now: string }
  | { type: 'deleteLeaf'; id: string };

function newNode(id: string, title: string, now: string): NamNode {
  return {
    id,
    title,
    description: null,
    status: 'BACKLOG',
    project: false,
    childIds: [],
    tags: [],
    blockedBy: [],
    resources: [],
    createdAt: now,
    updatedAt: now,
    statusChangedAt: null,
    dueAt: null,
  };
}

/** Remove `id` from whichever node lists it as a child (in place on `doc`). */
function detach(doc: WorkspaceDocument, id: string): void {
  for (const node of Object.values(doc.nodes)) {
    const i = node.childIds.indexOf(id);
    if (i !== -1) {
      node.childIds.splice(i, 1);
      return;
    }
  }
}

/** Does this intent target a node that must already exist? (addInboxItem creates one.) */
export function intentTargetExists(doc: WorkspaceDocument, intent: Intent): boolean {
  if (intent.type === 'addInboxItem') return true;
  return Boolean(doc.nodes[intent.id]);
}

/** Apply an intent, returning a new document. No-ops if the target node is gone. */
export function applyIntent(doc: WorkspaceDocument, intent: Intent): WorkspaceDocument {
  const next = structuredClone(doc);

  switch (intent.type) {
    case 'addInboxItem': {
      next.nodes[intent.id] = newNode(intent.id, intent.title, intent.now);
      next.nodes[next.inboxNodeId]?.childIds.push(intent.id);
      return next;
    }
    case 'convertInboxToNext': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      detach(next, intent.id);
      next.nodes[next.nextActionsNodeId]?.childIds.push(intent.id);
      node.status = 'NEXT';
      node.updatedAt = intent.now;
      node.statusChangedAt = intent.now;
      return next;
    }
    case 'setStatus': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      node.status = intent.status;
      node.updatedAt = intent.now;
      node.statusChangedAt = intent.now;
      return next;
    }
    case 'deleteLeaf': {
      if (!next.nodes[intent.id]) return next;
      detach(next, intent.id);
      delete next.nodes[intent.id];
      return next;
    }
  }
}
