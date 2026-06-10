// Lens selectors — pure functions that interpret the flat node map into the
// MVP views, ported verbatim from the NamDesktop Java lenses:
//   - InboxLens:       direct children of the inbox node (any status)
//   - NextActionsLens: status == NEXT && !project && not a structural node
//   - BacklogLens:     status == BACKLOG && !project && parent != inbox && not structural
// Structural nodes (root/inbox/projects/nextActions) are containers and never
// appear in action lists.

import type { NamNode, WorkspaceDocument } from './types';

/** The container node ids that should never show up as actions. */
export function structuralNodeIds(doc: WorkspaceDocument): Set<string> {
  return new Set([doc.rootNodeId, doc.inboxNodeId, doc.projectsNodeId, doc.nextActionsNodeId]);
}

/** Map of childId -> parentId, derived from every node's childIds. */
export function buildParentIndex(doc: WorkspaceDocument): Map<string, string> {
  const parents = new Map<string, string>();
  for (const node of Object.values(doc.nodes)) {
    for (const childId of node.childIds) {
      parents.set(childId, node.id);
    }
  }
  return parents;
}

export function getNode(doc: WorkspaceDocument, id: string): NamNode | undefined {
  return doc.nodes[id];
}

/** Inbox = direct children of the inbox node, in child order, regardless of status. */
export function inboxItems(doc: WorkspaceDocument): NamNode[] {
  const inbox = doc.nodes[doc.inboxNodeId];
  if (!inbox) return [];
  return inbox.childIds.map((id) => doc.nodes[id]).filter((n): n is NamNode => Boolean(n));
}

/** Next Actions = NEXT, non-project, non-structural, from anywhere in the tree. */
export function nextActions(doc: WorkspaceDocument): NamNode[] {
  const structural = structuralNodeIds(doc);
  return Object.values(doc.nodes).filter(
    (n) => n.status === 'NEXT' && !n.project && !structural.has(n.id),
  );
}

/** Backlog = BACKLOG, non-project, non-structural, not an unprocessed inbox item. */
export function backlogItems(doc: WorkspaceDocument): NamNode[] {
  const structural = structuralNodeIds(doc);
  const parents = buildParentIndex(doc);
  return Object.values(doc.nodes).filter(
    (n) =>
      n.status === 'BACKLOG' &&
      !n.project &&
      !structural.has(n.id) &&
      parents.get(n.id) !== doc.inboxNodeId,
  );
}
