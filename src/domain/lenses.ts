// Lens selectors — pure functions that interpret the flat node map into the
// MVP views, ported verbatim from the NamDesktop Java lenses:
//   - InboxLens:       direct children of the inbox node (any status)
//   - NextActionsLens: status == NEXT && !project && not a structural node
//   - BacklogLens:     status == BACKLOG && !project && parent != inbox && not structural
// Structural nodes (root/inbox/projects/nextActions) are containers and never
// appear in action lists.

import type { NamNode, WorkspaceDocument } from './types';
import { SYSTEM_TAGS, canonicalTag } from './systemTags';

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
  const archived = archivedNodeIds(doc);
  return Object.values(doc.nodes).filter(
    (n) => n.status === 'NEXT' && !n.project && !structural.has(n.id) && !archived.has(n.id),
  );
}

/**
 * Apply a saved per-view manual order to a list of nodes. Nodes whose id appears in `order`
 * come first, in that order; any new nodes (not yet in `order`) keep their incoming order and
 * are appended; ids no longer present are simply ignored. Pure; an empty/missing order is a
 * no-op (returns the input order). The persisted order lives in `doc.viewOrders[view]`.
 */
export function applyViewOrder(nodes: NamNode[], order: string[] | undefined): NamNode[] {
  if (!order || order.length === 0) return nodes;
  const pos = new Map(order.map((id, i) => [id, i] as const));
  const known = nodes.filter((n) => pos.has(n.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  const fresh = nodes.filter((n) => !pos.has(n.id));
  return [...known, ...fresh];
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
 * Project ids that are archived — either explicitly (their own `status === 'ARCHIVED'`) or
 * transitively (an ancestor project is archived). We only ever set ARCHIVED on a top-level
 * project, so its whole sub-tree is implicitly archived too. Used to keep archived projects
 * out of "move/file into a project" target pickers.
 */
export function archivedProjectIds(doc: WorkspaceDocument): Set<string> {
  const parents = buildParentIndex(doc);
  const structural = structuralNodeIds(doc);
  const archived = new Set<string>();
  for (const node of Object.values(doc.nodes)) {
    if (!node.project) continue;
    let cursor: string | undefined = node.id;
    while (cursor && !structural.has(cursor)) {
      if (doc.nodes[cursor]?.status === 'ARCHIVED') {
        archived.add(node.id);
        break;
      }
      cursor = parents.get(cursor);
    }
  }
  return archived;
}

/**
 * Every node within an archived subtree: any node whose own `status === 'ARCHIVED'`, plus all of
 * its descendants. Archiving only ever sets ARCHIVED on a top-level project, so in practice this is
 * "everything under an archived project" (the project, its sub-projects, and all their actions).
 * Used to keep archived work out of the action-listing views (Next, Backlog, Due, Blocked, Done,
 * tag context, Search), where descendant actions otherwise keep their NEXT/BACKLOG status.
 */
export function archivedNodeIds(doc: WorkspaceDocument): Set<string> {
  const ids = new Set<string>();
  for (const node of Object.values(doc.nodes)) {
    if (node.status === 'ARCHIVED') {
      for (const id of subtreeIds(doc, node.id)) ids.add(id);
    }
  }
  return ids;
}

/** A project's direct child nodes, in `childIds` order, filtered by kind. */
function childrenByKind(doc: WorkspaceDocument, projectId: string, wantProject: boolean): NamNode[] {
  const node = doc.nodes[projectId];
  if (!node) return [];
  return node.childIds
    .map((id) => doc.nodes[id])
    .filter((n): n is NamNode => Boolean(n) && n.project === wantProject);
}

/** A project's direct actions (non-project children), in `childIds` order. */
export function projectActions(doc: WorkspaceDocument, projectId: string): NamNode[] {
  return childrenByKind(doc, projectId, false);
}

/** A project's direct sub-projects, in `childIds` order. */
export function subProjects(doc: WorkspaceDocument, projectId: string): NamNode[] {
  return childrenByKind(doc, projectId, true);
}

export interface ProjectMoveTarget {
  id: string;
  label: string;
}

/** Which neighbour direction a quick-move target is — drives the fast menu's grouping + tooltips. */
export type MoveKind = 'parent' | 'subproject' | 'sibling' | 'free' | 'toplevel';

/** A proximate move target tagged with its neighbour kind (for {@link actionMoveTargets} etc.). */
export interface QuickMoveTarget extends ProjectMoveTarget {
  kind: MoveKind;
}

/**
 * Where an **action** can be moved (from the project it's in): its **parent project** (one level up;
 * "Free actions" when the action sits in a top-level project), its **sibling projects** (other
 * projects under the same parent), **down** into its current project's own **sub-projects**, and
 * **Free actions** (the loose-actions root). A **free** action (already in the loose-actions root)
 * gets the **top-level projects** instead — the natural places to file it (#694). Excludes archived
 * projects and the action's current container. Actions only — empty for projects.
 */
export function actionMoveTargets(doc: WorkspaceDocument, actionId: string): QuickMoveTarget[] {
  const action = doc.nodes[actionId];
  if (!action || action.project) return [];
  const containerId = Object.values(doc.nodes).find((n) => n.childIds.includes(actionId))?.id;
  if (!containerId) return [];
  const container = doc.nodes[containerId];
  const archived = archivedProjectIds(doc);
  const targets: QuickMoveTarget[] = [];
  const labelFor = (n: NamNode) => [...projectPath(doc, n.id), n.title].join(' › ');

  if (container?.project) {
    const parentId = Object.values(doc.nodes).find((n) => n.childIds.includes(containerId))?.id;
    const parent = parentId ? doc.nodes[parentId] : undefined;
    // Move up to the enclosing project (only when the container's parent is itself a project).
    if (parent?.project && !archived.has(parent.id)) targets.push({ id: parent.id, label: labelFor(parent), kind: 'parent' });
    // Sibling projects: other projects under the container's parent.
    for (const cid of parent?.childIds ?? []) {
      const n = doc.nodes[cid];
      if (n?.project && cid !== containerId && !archived.has(cid)) targets.push({ id: cid, label: labelFor(n), kind: 'sibling' });
    }
    // Down: this project's own sub-projects (move the action a level deeper).
    for (const cid of container.childIds) {
      const n = doc.nodes[cid];
      if (n?.project && !archived.has(cid)) targets.push({ id: cid, label: labelFor(n), kind: 'subproject' });
    }
  }
  // Free actions (the loose-actions root) — unless the action is already there.
  if (containerId !== doc.nextActionsNodeId) targets.push({ id: doc.nextActionsNodeId, label: 'Free actions', kind: 'free' });
  // A free action's proximate destinations are the top-level projects (#694) — without this the
  // loose actions you'd most want to file somewhere had no quick targets at all.
  if (containerId === doc.nextActionsNodeId) {
    for (const cid of doc.nodes[doc.projectsNodeId]?.childIds ?? []) {
      const n = doc.nodes[cid];
      if (n?.project && !archived.has(cid)) targets.push({ id: cid, label: labelFor(n), kind: 'toplevel' });
    }
  }
  return targets;
}

/**
 * Every place an **action** can be moved to: **Free actions** plus **every non-archived project**
 * (any depth), labelled by path. The "browse anywhere" superset of {@link actionMoveTargets}
 * (which is just the proximate parent/siblings/Free). Used to feed the column picker's full target
 * set for an action.
 */
export function actionMoveTargetsAll(doc: WorkspaceDocument, actionId: string): ProjectMoveTarget[] {
  const action = doc.nodes[actionId];
  if (!action || action.project) return [];
  const archived = archivedProjectIds(doc);
  const targets: ProjectMoveTarget[] = [{ id: doc.nextActionsNodeId, label: 'Free actions' }];
  for (const candidate of Object.values(doc.nodes)) {
    if (!candidate.project || archived.has(candidate.id)) continue;
    targets.push({ id: candidate.id, label: [...projectPath(doc, candidate.id), candidate.title].join(' › ') });
  }
  return targets;
}

/**
 * The **proximate** destinations for moving a project `id`: a **"Top level"** entry (only when `id`
 * is currently nested) plus its **sibling projects** (same parent). The quick subset of
 * {@link projectMoveTargets} (which also lists every other project) — for the fast-move menu.
 */
export function projectQuickMoveTargets(doc: WorkspaceDocument, id: string): QuickMoveTarget[] {
  if (!doc.nodes[id]) return [];
  const excluded = subtreeIds(doc, id);
  const archived = archivedProjectIds(doc);
  const parentId = Object.values(doc.nodes).find((n) => n.childIds.includes(id))?.id;
  const topLevel: QuickMoveTarget[] =
    parentId && parentId !== doc.projectsNodeId
      ? [{ id: doc.projectsNodeId, label: 'Top level', kind: 'toplevel' }]
      : [];
  const parent = parentId ? doc.nodes[parentId] : undefined;
  const siblings = (parent?.childIds ?? [])
    .filter((cid) => Boolean(doc.nodes[cid]?.project) && !excluded.has(cid) && !archived.has(cid))
    .map((cid) => doc.nodes[cid]!)
    .map((n): QuickMoveTarget => ({ id: n.id, label: [...projectPath(doc, n.id), n.title].join(' › '), kind: 'sibling' }));
  return [...topLevel, ...siblings];
}

/** Every openable (non-archived) project as a picker target — the whole tree is selectable in the
 *  picker's "open" mode (#595), unlike move mode's constrained destination sets. */
export function allOpenableProjects(doc: WorkspaceDocument): ProjectMoveTarget[] {
  const archived = archivedProjectIds(doc);
  return Object.values(doc.nodes)
    .filter((n) => n.project && !archived.has(n.id))
    .map((n) => ({ id: n.id, label: n.title }));
}

/** Every openable action — non-project, non-structural, not in an archived subtree, not
 *  DONE/CANCELLED — as picker targets ({id, label: title}). The "files" counterpart of
 *  allOpenableProjects for the browser's actions/both modes (#657).
 *  NB: inbox children and sub-actions of actions are included but currently unreachable in the
 *  columns (no Inbox root; actions aren't drilled into) — inert until a browse root exists (#663). */
export function allOpenableActions(doc: WorkspaceDocument): { id: string; label: string }[] {
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  return Object.values(doc.nodes)
    .filter(
      (n) =>
        !n.project &&
        !structural.has(n.id) &&
        !archived.has(n.id) &&
        n.status !== 'DONE' &&
        n.status !== 'CANCELLED',
    )
    .map((n) => ({ id: n.id, label: n.title }));
}

/**
 * Projects that `id` can be moved into (made a sub-project of): a **"Top level"** entry first when
 * `id` is currently nested, then its **current project siblings** (same parent), then every other
 * project labelled by path. Excludes `id` itself, its own subtree, and its current parent.
 */
export function projectMoveTargets(doc: WorkspaceDocument, id: string): ProjectMoveTarget[] {
  if (!doc.nodes[id]) return [];
  const excluded = subtreeIds(doc, id);
  const archived = archivedProjectIds(doc); // never offer an archived project as a destination
  const parentId = Object.values(doc.nodes).find((n) => n.childIds.includes(id))?.id;
  const parent = parentId ? doc.nodes[parentId] : undefined;
  const siblingIds = parent
    ? parent.childIds.filter(
        (cid) => Boolean(doc.nodes[cid]?.project) && !excluded.has(cid) && !archived.has(cid),
      )
    : [];
  const sibSet = new Set(siblingIds);
  const toTarget = (n: NamNode): ProjectMoveTarget => ({
    id: n.id,
    label: [...projectPath(doc, n.id), n.title].join(' › '),
  });

  const topLevel: ProjectMoveTarget[] =
    parentId && parentId !== doc.projectsNodeId ? [{ id: doc.projectsNodeId, label: 'Top level' }] : [];
  const siblings = siblingIds.map((cid) => doc.nodes[cid]!);
  const others = Object.values(doc.nodes).filter(
    (n) => n.project && !excluded.has(n.id) && !archived.has(n.id) && !sibSet.has(n.id) && n.id !== parentId,
  );
  return [...topLevel, ...siblings.map(toTarget), ...others.map(toTarget)];
}

/**
 * Splice a new order for one *kind* of child (e.g. just the actions, or just the sub-projects)
 * back into the parent's full `childIds`, leaving the other kind in their existing slots. The
 * caller hand-orders one kind (via drag); we keep the interleaving stable. `kindOrder` must be a
 * permutation of the kind's ids already present in `childIds`; ids not in `childIds` are ignored
 * and the original order is returned if any are missing. Pure — feed the result to
 * `reorderChildren`.
 */
export function reorderKindWithinChildren(childIds: string[], kindOrder: string[]): string[] {
  const kindSet = new Set(kindOrder);
  if (kindOrder.some((id) => !childIds.includes(id))) return childIds;
  let k = 0;
  return childIds.map((id) => (kindSet.has(id) ? kindOrder[k++] : id));
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
  const archived = archivedNodeIds(doc);
  const byBlocker = new Map<string, NamNode[]>();
  for (const node of Object.values(doc.nodes)) {
    if (node.project || node.status === 'DONE' || structural.has(node.id) || archived.has(node.id)) continue;
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
 * Open (not DONE/CANCELLED) actions with a due date, grouped by urgency relative to `now`:
 * overdue / today / within a week / later. Mirrors NamDesktop's DueLens; agrees with the
 * calendar's notion of "open" (#694).
 */
export function dueGroups(doc: WorkspaceDocument, now: Date = new Date()): DueGroups {
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups: DueGroups = { overdue: [], today: [], thisWeek: [], later: [] };
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  for (const node of Object.values(doc.nodes)) {
    if (node.project || node.status === 'DONE' || node.status === 'CANCELLED' || structural.has(node.id) || archived.has(node.id) || !node.dueAt) continue;
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

/** Sorted, de-duplicated tags present across all nodes, plus the registered tags — and the
 *  built-in system tags (#651), which are always on offer even before first use. */
export function allTags(doc: WorkspaceDocument): string[] {
  // canonicalTag collapses NamDesktop-written case variants of system tags ("In Progress") into
  // the built-in lowercase form, so the list never shows both spellings (#654).
  const set = new Set<string>([...SYSTEM_TAGS, ...doc.registeredTags.map(canonicalTag)]);
  for (const node of Object.values(doc.nodes)) for (const tag of node.tags) set.add(canonicalTag(tag));
  return [...set].sort();
}

/**
 * Non-done actions whose effective tags (own + inherited) include *every* required
 * tag (AND). `nextOnly` restricts to NEXT. Mirrors NamDesktop's ContextLens.
 */
export function contextItems(
  doc: WorkspaceDocument,
  requiredTags: string[],
  nextOnly = false,
): NamNode[] {
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  return Object.values(doc.nodes).filter((n) => {
    if (n.project || n.status === 'DONE' || structural.has(n.id) || archived.has(n.id)) return false;
    if (nextOnly && n.status !== 'NEXT') return false;
    if (requiredTags.length === 0) return true;
    // Case-insensitive match: the web normalizes tags to lowercase, but NamDesktop-written
    // documents can carry case variants — a lowercase filter must still find them (#654).
    const tags = new Set(effectiveTags(doc, n.id).map((t) => t.trim().toLowerCase()));
    return requiredTags.every((t) => tags.has(t.trim().toLowerCase()));
  });
}

export interface SearchResult {
  node: NamNode;
  /** Ancestor project titles, for context. */
  path: string[];
}

/** Case-insensitive title/tag search over non-structural, non-done nodes (actions and projects). */
export function searchResults(doc: WorkspaceDocument, query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  return Object.values(doc.nodes)
    .filter((n) => {
      if (structural.has(n.id) || n.status === 'DONE' || archived.has(n.id)) return false;
      // Match effective tags (own + inherited from ancestor projects) so a rubbed-off tag is
      // searchable like any real tag.
      return (
        n.title.toLowerCase().includes(q) ||
        effectiveTags(doc, n.id).some((t) => t.toLowerCase().includes(q))
      );
    })
    .map((node) => ({ node, path: projectPath(doc, node.id) }));
}

/** Done = DONE, non-project, non-structural — completed actions, kept for reference. */
export function doneItems(doc: WorkspaceDocument): NamNode[] {
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  return Object.values(doc.nodes).filter(
    (n) => n.status === 'DONE' && !n.project && !structural.has(n.id) && !archived.has(n.id),
  );
}

/** Backlog = BACKLOG, non-project, non-structural, not an unprocessed inbox item. */
export function backlogItems(doc: WorkspaceDocument): NamNode[] {
  const structural = structuralNodeIds(doc);
  const parents = buildParentIndex(doc);
  const archived = archivedNodeIds(doc);
  return Object.values(doc.nodes).filter(
    (n) =>
      n.status === 'BACKLOG' &&
      !n.project &&
      !structural.has(n.id) &&
      !archived.has(n.id) &&
      parents.get(n.id) !== doc.inboxNodeId,
  );
}
