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

/** `id` plus every descendant id, walked via `childIds`. */
export function subtreeIds(doc: WorkspaceDocument, id: string): Set<string> {
  const ids = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (ids.has(cur)) continue;
    ids.add(cur);
    for (const child of doc.nodes[cur]?.childIds ?? []) stack.push(child);
  }
  return ids;
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

/**
 * Ancestor nodes for a node, top-most first, excluding structural containers
 * (root/inbox/projects/actions) — the enclosing project chain, for breadcrumbs.
 * Empty when the node sits directly under a structural container. Mirrors
 * NamDesktop's `buildPath`.
 */
export function buildPath(doc: WorkspaceDocument, id: string): NamNode[] {
  const parents = buildParentIndex(doc);
  const structural = structuralNodeIds(doc);
  const path: NamNode[] = [];
  let cursor = parents.get(id);
  while (cursor && !structural.has(cursor)) {
    const ancestor = doc.nodes[cursor];
    if (ancestor) path.unshift(ancestor);
    cursor = parents.get(cursor);
  }
  return path;
}

/** Ancestor project *titles*, top-most first — the string form of {@link buildPath}. */
export function projectPath(doc: WorkspaceDocument, id: string): string[] {
  return buildPath(doc, id).map((n) => n.title);
}

/** Top-level projects: the project children directly under the projects node. */
export function projects(doc: WorkspaceDocument): NamNode[] {
  const root = doc.nodes[doc.projectsNodeId];
  if (!root) return [];
  return root.childIds
    .map((id) => doc.nodes[id])
    .filter((n): n is NamNode => Boolean(n) && n.project);
}

/**
 * A node's own tags plus tags inherited from its ancestor projects, de-duplicated
 * with own tags first. Mirrors NamDesktop's `effectiveTags`.
 */
export function effectiveTags(doc: WorkspaceDocument, id: string): string[] {
  const node = doc.nodes[id];
  if (!node) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (tags: string[]) => {
    for (const tag of tags) {
      if (!seen.has(tag)) {
        seen.add(tag);
        out.push(tag);
      }
    }
  };
  add(node.tags);
  for (const ancestor of buildPath(doc, id)) add(ancestor.tags);
  return out;
}

/** Following `blockedBy` edges from `startId`, can we reach `targetId`? */
function dependsOn(doc: WorkspaceDocument, startId: string, targetId: string): boolean {
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === targetId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const b of doc.nodes[cur]?.blockedBy ?? []) stack.push(b);
  }
  return false;
}

/** May `prereqId` be added as a prerequisite of `actionId`? (exists, not self, not dup, no cycle) */
export function canAddPrerequisite(doc: WorkspaceDocument, actionId: string, prereqId: string): boolean {
  const action = doc.nodes[actionId];
  if (actionId === prereqId || !action || !doc.nodes[prereqId]) return false;
  if (action.blockedBy.includes(prereqId)) return false;
  // adding action→prereq would cycle iff prereq already (transitively) depends on action
  return !dependsOn(doc, prereqId, actionId);
}

/** True when a node has at least one prerequisite that isn't DONE. */
export function isBlocked(doc: WorkspaceDocument, id: string): boolean {
  const node = doc.nodes[id];
  if (!node) return false;
  return node.blockedBy.some((b) => doc.nodes[b] && doc.nodes[b].status !== 'DONE');
}

/** Actions that list `id` among their prerequisites — they unblock when `id` is done. */
export function unblocks(doc: WorkspaceDocument, id: string): NamNode[] {
  return Object.values(doc.nodes).filter((n) => n.blockedBy.includes(id));
}

export interface BlockedGroup {
  blocker: NamNode;
  actions: NamNode[];
}

/** Blocked actions grouped by each active (non-DONE) prerequisite. Mirrors NamDesktop's BlockedLens. */
export function blockedGroups(doc: WorkspaceDocument): BlockedGroup[] {
  const structural = structuralNodeIds(doc);
  const byBlocker = new Map<string, NamNode[]>();
  for (const node of Object.values(doc.nodes)) {
    if (node.project || node.status === 'DONE' || structural.has(node.id)) continue;
    for (const bid of node.blockedBy) {
      const blocker = doc.nodes[bid];
      if (!blocker || blocker.status === 'DONE') continue;
      const list = byBlocker.get(bid) ?? [];
      list.push(node);
      byBlocker.set(bid, list);
    }
  }
  return [...byBlocker.keys()].map((bid) => ({ blocker: doc.nodes[bid]!, actions: byBlocker.get(bid)! }));
}

export interface DueGroups {
  overdue: NamNode[];
  today: NamNode[];
  thisWeek: NamNode[];
  later: NamNode[];
}

/**
 * Non-done actions with a due date, grouped by urgency relative to `now`:
 * overdue / today / within a week / later. Mirrors NamDesktop's DueLens.
 */
export function dueGroups(doc: WorkspaceDocument, now: Date = new Date()): DueGroups {
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups: DueGroups = { overdue: [], today: [], thisWeek: [], later: [] };
  const structural = structuralNodeIds(doc);
  for (const node of Object.values(doc.nodes)) {
    if (node.project || node.status === 'DONE' || structural.has(node.id) || !node.dueAt) continue;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(node.dueAt);
    if (!match) continue;
    const due0 = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
    const days = Math.round((due0 - today0) / 86_400_000);
    if (days < 0) groups.overdue.push(node);
    else if (days === 0) groups.today.push(node);
    else if (days <= 7) groups.thisWeek.push(node);
    else groups.later.push(node);
  }
  return groups;
}

/** Done = DONE, non-project, non-structural — completed actions, kept for reference. */
export function doneItems(doc: WorkspaceDocument): NamNode[] {
  const structural = structuralNodeIds(doc);
  return Object.values(doc.nodes).filter(
    (n) => n.status === 'DONE' && !n.project && !structural.has(n.id),
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
