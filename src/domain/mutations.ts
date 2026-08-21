// Intent-based mutations on the workspace document. Each `Intent` is a small,
// named, self-contained operation carrying any locally-generated values (ids,
// timestamps) so it can be *replayed* onto a freshly pulled document during the
// sync conflict-retry. All functions are pure: they return a new document and
// never mutate the input. Mirrors NamDesktop `NamWorkspaceService`.

import type { Bookmark, NamNode, NodeStatus, Resource, TemplateNode, WorkspaceDocument } from './types';
import { CHECKLIST_TAG, IN_PROGRESS_TAG, SYSTEM_TAGS, canonicalTag, isChecklist, isSystemTag } from './systemTags';
import { canAddPrerequisite, subtreeIds } from './lenses';
import { deleteTagInContextOrders, renameTagInContextOrders } from './contextViewKey';
import { formatCount, parseCount } from './resourceCount';
import { formatQuestion, parseQuestion } from './resourceQuestion';
import { makeActionLink, parseActionLink } from './actionLinks';

export type Intent =
  | { type: 'addInboxItem'; id: string; title: string; atTop?: boolean; now: string }
  | { type: 'convertInboxToNext'; id: string; now: string }
  | { type: 'convertInboxToAction'; id: string; status: NodeStatus; parentId?: string; tags?: string[]; now: string }
  | { type: 'convertInboxToProject'; id: string; parentId?: string; tags?: string[]; now: string }
  | {
      type: 'setStatus';
      id: string;
      status: NodeStatus;
      now: string;
      /** Override for the resulting `statusChangedAt` (defaults to `now`). Lets an Undo restore
       *  the original change-time instead of stamping the undo itself as a status change. */
      statusChangedAt?: string | null;
      /** Apply only while the node still has this status. Lets a stale Undo (the node has since
       *  been re-statused by a newer change) no-op instead of overwriting the newer choice. */
      expectedStatus?: NodeStatus;
      /** Undo of a terminal change: re-add the in-progress mark the strip removed (#716/#724).
       *  Applies only when the restored status is non-terminal and the tag is absent. */
      restoreInProgress?: boolean;
    }
  | { type: 'updateNode'; id: string; title: string; description: string | null; now: string }
  | { type: 'setDue'; id: string; dueAt: string | null; dueEndAt?: string | null; dueTime?: string | null; dueEndTime?: string | null; now: string }
  | { type: 'setDeriveDue'; id: string; on: boolean; now: string }
  | { type: 'updateTags'; id: string; tags: string[]; now: string }
  | { type: 'registerTag'; tag: string }
  | { type: 'renameTag'; from: string; to: string }
  | { type: 'deleteTag'; tag: string }
  | { type: 'updateResources'; id: string; resources: Resource[]; now: string }
  | { type: 'addAction'; parentId: string; id: string; title: string; status: NodeStatus; atTop?: boolean; dueAt?: string; dueTime?: string; now: string }
  | { type: 'addSubProject'; parentId: string; id: string; title: string; atTop?: boolean; now: string }
  | { type: 'moveNode'; id: string; newParentId: string; now: string }
  | { type: 'convertActionToProject'; id: string; now: string }
  | { type: 'convertProjectToAction'; id: string; status: NodeStatus; now: string }
  // Two modes, selected by `eventId`. PILL MODE (owner's own tap, `eventId` absent): `expectedValue`
  // is the stale guard. LEDGER MODE (the guest-event drain, `eventId` set): the event id makes the
  // apply idempotent — an id at or below the resource's `drainedThrough` watermark no-ops; no
  // `expectedValue`, the delta clamps instead of no-oping, and the watermark advances (#832/#850).
  | { type: 'incrementCountResource'; id: string; index: number; expectedValue?: string; delta?: 1 | -1; eventId?: number; now: string }
  | { type: 'answerQuestionResource'; id: string; index: number; expectedValue?: string; answer: 'yes' | 'no' | 'clear'; eventId?: number; now: string }
  | { type: 'addPrerequisite'; actionId: string; prereqId: string; now: string }
  | { type: 'removePrerequisite'; actionId: string; prereqId: string; now: string }
  | { type: 'createSavedView'; name: string; tags: string[]; nextOnly: boolean }
  | { type: 'renameSavedView'; oldName: string; newName: string }
  | { type: 'deleteSavedView'; name: string }
  | { type: 'createMissionControl'; name: string; tags: string[] }
  | { type: 'deleteMissionControl'; name: string }
  | { type: 'addBookmark'; bookmark: Bookmark }
  | { type: 'removeBookmark'; id: string }
  | { type: 'renameBookmark'; id: string; label: string }
  | { type: 'reorderBookmarks'; order: string[] }
  | { type: 'reorderView'; view: string; order: string[] }
  | { type: 'reorderChildren'; parentId: string; order: string[] }
  | { type: 'saveAsTemplate'; name: string; nodeId: string }
  | { type: 'deleteTemplate'; name: string }
  | { type: 'applyTemplate'; parentId: string; nodes: SeedNode[]; now: string }
  | { type: 'seedProject'; parentId: string; nodes: SeedNode[]; atTop?: boolean; now: string }
  | { type: 'groupIntoSubProject'; parentId: string; subProjectId: string; title: string; actionIds: string[]; now: string }
  | { type: 'deleteRecursive'; id: string }
  | { type: 'deleteLeaf'; id: string }
  | { type: 'restoreNodes'; capture: DeletionCapture };

/**
 * Everything needed to put a deleted node (and its subtree) back exactly where it was — captured
 * *before* the delete so an Undo can replay it. `nodes[0]` is the subtree root; `blockedRefs` are the
 * external `blockedBy` links that `deleteRecursive` strips from other nodes.
 */
export interface DeletionCapture {
  nodes: NamNode[];
  parentId: string;
  index: number;
  blockedRefs: { nodeId: string; blockedId: string }[];
}

/** Snapshot a node + its subtree for a possible Undo. Returns null if the node isn't there. */
export function captureDeletion(doc: WorkspaceDocument, id: string): DeletionCapture | null {
  const node = doc.nodes[id];
  if (!node) return null;
  const subtree = subtreeIds(doc, id);
  // Root first, so restore re-attaches the right id; the rest are descendants (order doesn't matter).
  const nodes = [node, ...[...subtree].filter((n) => n !== id).map((n) => doc.nodes[n])]
    .filter((n): n is NamNode => Boolean(n))
    .map((n) => structuredClone(n));
  const parentId = parentOf(doc, id);
  const parent = parentId ? doc.nodes[parentId] : undefined;
  const blockedRefs: { nodeId: string; blockedId: string }[] = [];
  for (const other of Object.values(doc.nodes)) {
    if (subtree.has(other.id)) continue;
    for (const b of other.blockedBy) if (subtree.has(b)) blockedRefs.push({ nodeId: other.id, blockedId: b });
  }
  return {
    nodes,
    parentId: parentId ?? doc.rootNodeId,
    index: parent ? Math.max(0, parent.childIds.indexOf(id)) : 0,
    blockedRefs,
  };
}

/** Trimmed, lower-cased, de-duplicated, non-empty — mirrors NamDesktop tag handling. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    if (!raw.trim()) continue;
    const canon = canonicalTag(raw);
    // Known system tags → canonical sigil form (migrating legacy `in progress` on write).
    // Everything else — INCLUDING a user's #-prefixed tag — is kept as an ordinary lowercased
    // tag. The `#` namespace is reserved SEMANTICALLY (only registered #… tags behave as
    // system — see isSystemTag), NEVER by rewriting your input: demoting broke idempotence
    // (#in progress → in progress → #in-progress) and split one tag across stores (#844).
    const tag = SYSTEM_TAGS.includes(canon) ? canon : raw.trim().toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

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

/** Add `id` to a parent's children — at the top (default) or the bottom when `atTop === false`.
 *  Driven by the "add new items at the bottom" preference, carried on the intent so replay is stable.
 *
 *  PRINCIPLE (#894): an item created or converted **outside** a top/bottom-aware list view — where the
 *  user isn't choosing where it lands — should land **first**, so it's findable without scrolling.
 *  This governs the childIds-ordered surfaces (the projects list, a project workbench). NOTE the Next
 *  view is ordered by `viewOrders.next`, NOT childIds (#902) — a path landing an item there must also
 *  float it to the head of that saved order (see `convertProjectToAction`); the childIds unshift alone
 *  is invisible to the Next view. New "created-elsewhere" features should honor both. */
function placeChild(parent: NamNode, id: string, atTop?: boolean): void {
  if (atTop === false) parent.childIds.push(id);
  else parent.childIds.unshift(id);
}

/** Remove `id` from EVERY node that lists it as a child (in place on `doc`). Removing from all
 *  parents — not just the first (#1141) — matters when a node is (wrongly) aliased into two parents:
 *  detaching only the first leaves a dangling id behind, so a delete/move can't fully clean up. In
 *  the normal single-parent case this is one removal, same as before. */
function detach(doc: WorkspaceDocument, id: string): void {
  for (const node of Object.values(doc.nodes)) {
    const i = node.childIds.indexOf(id);
    if (i !== -1) node.childIds.splice(i, 1);
  }
}

/** The id of whichever node lists `id` as a child, or undefined. */
function parentOf(doc: WorkspaceDocument, id: string): string | undefined {
  for (const node of Object.values(doc.nodes)) {
    if (node.childIds.includes(id)) return node.id;
  }
  return undefined;
}

/**
 * Repair `childIds` corruption in place, returning whether anything changed (#1141). Two invariants
 * a healthy tree holds but a raced reorder-replay could break:
 *  - **no dangling ids** — every child id resolves to a live node; drop ids whose node is gone
 *    (the residue a delete leaves when a node was aliased into two parents);
 *  - **single parent** — each id is a child of at most one node; collapse an alias to its first
 *    occurrence (stable `Object.values` order) so a node can never live under two projects.
 * Self-heal is idempotent: a clean doc returns `false` and is untouched. Callers push once, guarded,
 * only when it reports a change. Structural containers aren't special-cased — they hold real ids too.
 */
export function normalizeChildIds(doc: WorkspaceDocument): boolean {
  const claimed = new Set<string>();
  let changed = false;
  for (const node of Object.values(doc.nodes)) {
    const kept = node.childIds.filter((id) => {
      if (!doc.nodes[id] || claimed.has(id)) return false; // dangling, or aliased to an earlier parent
      claimed.add(id);
      return true;
    });
    if (kept.length !== node.childIds.length) {
      node.childIds = kept;
      changed = true;
    }
  }
  return changed;
}

/**
 * A fully-resolved node subtree to seed (ids/dates pre-generated in the caller so `seedProject`
 * stays pure and replayable). Unlike a template it carries rich fields — status, tags, due, blockers
 * (by id, within the seed), resources, descriptions — so a seeded project can light up every view.
 */
export interface SeedNode {
  id: string;
  title: string;
  description?: string | null;
  project?: boolean;
  status?: NodeStatus;
  tags?: string[];
  dueAt?: string | null;
  /** Range end + times — carried so import (and any seed) preserves full scheduling (#509). */
  dueEndAt?: string | null;
  dueTime?: string | null;
  dueEndTime?: string | null;
  /** Projects only: the derive-from-contents toggle (#706) — carried so import preserves it (#711). */
  deriveDue?: boolean;
  /** Prerequisite ids — must reference other nodes within the same seed. */
  blockedBy?: string[];
  resources?: Resource[];
  children?: SeedNode[];
}

/** Insert a resolved seed subtree (rich fields, pre-assigned ids) under `parentId`. */
function insertSeed(doc: WorkspaceDocument, parentId: string, nodes: SeedNode[], now: string): void {
  for (const seed of nodes) {
    const node = newNode(seed.id, seed.title, now);
    node.project = seed.project ?? false;
    node.description = seed.description ?? null;
    node.status = seed.status ?? 'BACKLOG';
    node.statusChangedAt = seed.status ? now : null;
    node.tags = normalizeTags(seed.tags ?? []);
    node.dueAt = seed.dueAt ?? null;
    node.dueEndAt = seed.dueEndAt ?? null;
    node.dueTime = seed.dueTime ?? null;
    node.dueEndTime = seed.dueEndTime ?? null;
    if (seed.project && seed.deriveDue) node.deriveDue = true; // off = absent (#706)
    node.blockedBy = seed.blockedBy ?? [];
    node.resources = seed.resources ?? [];
    doc.nodes[seed.id] = node;
    doc.nodes[parentId]?.childIds.push(seed.id);
    if (node.tags.length) doc.registeredTags = normalizeTags([...doc.registeredTags, ...node.tags]);
    insertSeed(doc, seed.id, seed.children ?? [], now);
  }
}

/**
 * Resolve a template subtree to concrete SeedNodes with FRESH ids (#863) — for `applyTemplate`, which
 * reuses `insertSeed`, so a template reproduces the full project. Pure: `newId` is injected (one per
 * node) so the result is replay-stable. Intra-template `blockedBy` refs are remapped from the captured
 * ids to the new ids in a second pass (a blocker may reference a node later in the tree); refs that
 * don't map (external / legacy) are dropped.
 */
export function cloneTemplateNodes(nodes: TemplateNode[], newId: () => string): SeedNode[] {
  const assigned = new Map<TemplateNode, string>();
  const oldToNew = new Map<string, string>();
  const assign = (ns: TemplateNode[]): void => {
    for (const n of ns) {
      const id = newId();
      assigned.set(n, id);
      if (n.id) oldToNew.set(n.id, id);
      assign(n.children);
    }
  };
  assign(nodes);
  const build = (n: TemplateNode): SeedNode => ({
    id: assigned.get(n)!,
    title: n.title,
    project: n.project,
    description: n.description,
    status: n.status,
    tags: n.tags,
    dueAt: n.dueAt,
    dueEndAt: n.dueEndAt,
    dueTime: n.dueTime,
    dueEndTime: n.dueEndTime,
    deriveDue: n.deriveDue,
    blockedBy: n.blockedBy?.map((b) => oldToNew.get(b)).filter((x): x is string => Boolean(x)),
    // Remap intra-template action-links to the cloned target (#876) — the same self-containment
    // guarantee blockedBy gets, since a `nam://action/<id>` link is just an id ref inside a URI
    // resource. Links to targets OUTSIDE the template point elsewhere legitimately, so keep them.
    resources: n.resources?.map((r) => {
      const target = parseActionLink(r);
      const mapped = target ? oldToNew.get(target) : undefined;
      return mapped ? { ...makeActionLink(mapped), description: r.description } : r;
    }),
    children: n.children.map(build),
  });
  return nodes.map(build);
}

/**
 * Capture a node's children (recursively) as a template subtree (#863) — the full node, not just the
 * title: status, tags, due, derive, resources, description, and intra-subtree prerequisites. Fields
 * are omitted when default so a template stays lean and a legacy structure-only template is a subset.
 * `captured` is the set of ids in the whole subtree, so `blockedBy` keeps only within-template refs.
 */
function toTemplateNodes(doc: WorkspaceDocument, parentId: string, captured: Set<string>): TemplateNode[] {
  const parent = doc.nodes[parentId];
  if (!parent) return [];
  return parent.childIds
    .map((id) => doc.nodes[id])
    .filter((n): n is NamNode => Boolean(n))
    .map((n) => {
      const t: TemplateNode = { id: n.id, title: n.title, project: n.project, children: toTemplateNodes(doc, n.id, captured) };
      if (n.description) t.description = n.description;
      // A template instance is a DRAFT to review (#864): every ACTION is captured as NEXT — so a
      // created project surfaces all its work in Next (encouraging a real review), and no action is
      // ever stored/reproduced as DONE when it isn't. Projects (containers) keep the default.
      if (!n.project) t.status = 'NEXT';
      if (n.tags.length) t.tags = n.tags;
      if (n.dueAt) t.dueAt = n.dueAt;
      if (n.dueEndAt) t.dueEndAt = n.dueEndAt;
      if (n.dueTime) t.dueTime = n.dueTime;
      if (n.dueEndTime) t.dueEndTime = n.dueEndTime;
      if (n.deriveDue) t.deriveDue = true;
      const blockedBy = n.blockedBy.filter((b) => captured.has(b));
      if (blockedBy.length) t.blockedBy = blockedBy;
      if (n.resources.length) t.resources = n.resources;
      return t;
    });
}

/** The drain watermark for a resource — the highest applied guest-event id (0 if none). */
function drainedThroughAt(node: NamNode, index: number): number {
  return node.drainedThrough?.[index] ?? 0;
}

/** Advance a node's drain watermark for a resource, returning a NEW map (node already cloned). Only
 *  ever raises it (events arrive in id order), so idempotency is monotonic — never re-applies. */
function advanceDrainedThrough(
  drainedThrough: Record<number, number> | undefined,
  index: number,
  eventId: number,
): Record<number, number> {
  return { ...drainedThrough, [index]: Math.max(drainedThrough?.[index] ?? 0, eventId) };
}

const structuralIds = (doc: WorkspaceDocument): Set<string> =>
  new Set([doc.rootNodeId, doc.inboxNodeId, doc.projectsNodeId, doc.nextActionsNodeId]);

/** Does this intent target a node that must already exist? (addInboxItem creates one.) */
export function intentTargetExists(doc: WorkspaceDocument, intent: Intent): boolean {
  if (intent.type === 'addInboxItem' || intent.type === 'addSubProject' || intent.type === 'addAction') {
    return true;
  }
  if (intent.type === 'addPrerequisite' || intent.type === 'removePrerequisite') {
    return Boolean(doc.nodes[intent.actionId]);
  }
  if (
    intent.type === 'createSavedView' ||
    intent.type === 'renameSavedView' ||
    intent.type === 'deleteSavedView' ||
    intent.type === 'createMissionControl' ||
    intent.type === 'deleteMissionControl' ||
    intent.type === 'deleteTemplate' ||
    intent.type === 'reorderView' ||
    intent.type === 'registerTag' ||
    intent.type === 'renameTag' ||
    intent.type === 'deleteTag' ||
    intent.type === 'addBookmark' ||
    intent.type === 'removeBookmark' ||
    intent.type === 'renameBookmark' ||
    intent.type === 'reorderBookmarks' ||
    intent.type === 'restoreNodes'
  ) {
    return true; // operate on a document-level list, not a node
  }
  if (intent.type === 'saveAsTemplate') return Boolean(doc.nodes[intent.nodeId]);
  if (
    intent.type === 'applyTemplate' ||
    intent.type === 'seedProject' ||
    intent.type === 'groupIntoSubProject' ||
    intent.type === 'reorderChildren'
  ) {
    return Boolean(doc.nodes[intent.parentId]);
  }
  return Boolean(doc.nodes[intent.id]);
}

const isChecklistProject = (doc: WorkspaceDocument, id: string | undefined): boolean => {
  const n = id ? doc.nodes[id] : undefined;
  return Boolean(n?.project && isChecklist(n));
};

const hasSubProject = (doc: WorkspaceDocument, id: string): boolean =>
  (doc.nodes[id]?.childIds ?? []).some((cid) => doc.nodes[cid]?.project);

const CHECKLIST_NO_SUBPROJECTS =
  'A #checklist project can hold check-items (actions) but not sub-projects. ' +
  'Remove #checklist first, or place this under a normal project.';
const CHECKLIST_HAS_SUBPROJECTS =
  'This project has sub-projects, so it cannot be a #checklist (checklists hold only check-items). ' +
  'Move or remove the sub-projects first.';

/**
 * Business-rule validation the reducer itself can't enforce loudly (#1147). Returns a human-readable
 * error message when an intent would violate the `#checklist` invariant — a checklist project may
 * hold check-items (actions) but NEVER sub-projects — or `null` when the intent is allowed.
 *
 * `applyIntent` calls this as a no-op backstop (a violating intent leaves the doc unchanged, keeping
 * replay safe), and the write surfaces call it to FAIL LOUDLY: the MCP `commit` wrapper throws it as
 * a tool error, and the web toasts it. "Silently reinterpreting the user's structure is worse than
 * refusing the operation" — so this refuses, it never flattens.
 */
export function validateIntent(doc: WorkspaceDocument, intent: Intent): string | null {
  switch (intent.type) {
    case 'addSubProject':
      return isChecklistProject(doc, intent.parentId) ? CHECKLIST_NO_SUBPROJECTS : null;
    case 'groupIntoSubProject':
      return isChecklistProject(doc, intent.parentId) ? CHECKLIST_NO_SUBPROJECTS : null;
    case 'moveNode':
      // Moving an ACTION into a checklist is fine (it becomes a check-item); moving a PROJECT in is not.
      return doc.nodes[intent.id]?.project && isChecklistProject(doc, intent.newParentId)
        ? CHECKLIST_NO_SUBPROJECTS
        : null;
    case 'convertActionToProject':
      // A check-item promoted to a project would become a sub-project of the checklist.
      return isChecklistProject(doc, parentOf(doc, intent.id)) ? CHECKLIST_NO_SUBPROJECTS : null;
    case 'convertInboxToProject':
      // Processing an inbox item straight into a project under a checklist (#1159).
      return isChecklistProject(doc, intent.parentId) ? CHECKLIST_NO_SUBPROJECTS : null;
    case 'applyTemplate':
    case 'seedProject':
      // A template/seed whose top level contains a project would land a sub-project under the
      // checklist (#1159). All-action seeds — a checklist template — are fine.
      return isChecklistProject(doc, intent.parentId) && intent.nodes.some((n) => n.project)
        ? CHECKLIST_NO_SUBPROJECTS
        : null;
    case 'restoreNodes':
      // Undo restoring a previously-deleted sub-project after its parent became a checklist (#1159).
      return isChecklistProject(doc, intent.capture.parentId) && Boolean(intent.capture.nodes[0]?.project)
        ? CHECKLIST_NO_SUBPROJECTS
        : null;
    case 'updateTags': {
      const node = doc.nodes[intent.id];
      if (!node?.project) return null;
      const addingChecklist =
        intent.tags.some((t) => canonicalTag(t) === CHECKLIST_TAG) && !isChecklist(node);
      return addingChecklist && hasSubProject(doc, intent.id) ? CHECKLIST_HAS_SUBPROJECTS : null;
    }
    default:
      return null;
  }
}

/** Apply an intent, returning a new document. No-ops if the target node is gone. */
export function applyIntent(doc: WorkspaceDocument, intent: Intent): WorkspaceDocument {
  const next = structuredClone(doc);

  // Backstop for the #checklist invariant (#1147): a violating intent leaves the doc unchanged, so a
  // replayed or foreign intent that slipped past the loud check (MCP throw / web toast) still can't
  // corrupt the tree. applyIntent stays no-throw (the sync replay depends on it).
  if (validateIntent(doc, intent) !== null) return next;

  switch (intent.type) {
    case 'addInboxItem': {
      next.nodes[intent.id] = newNode(intent.id, intent.title, intent.now);
      // Top by default (latest capture visible without scrolling); bottom when the user prefers it.
      const inbox = next.nodes[next.inboxNodeId];
      if (inbox) placeChild(inbox, intent.id, intent.atTop);
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
    case 'convertInboxToAction': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      // File under the chosen project, or fall back to Free actions (incl. when a stale id is replayed).
      const target = intent.parentId && next.nodes[intent.parentId] ? intent.parentId : next.nextActionsNodeId;
      detach(next, intent.id);
      next.nodes[target]?.childIds.push(intent.id);
      node.project = false;
      node.status = intent.status;
      // Tags chosen during clarification (#920) — additive, so any tag already on the capture stays.
      if (intent.tags?.length) node.tags = normalizeTags([...node.tags, ...intent.tags]);
      node.updatedAt = intent.now;
      node.statusChangedAt = intent.now;
      return next;
    }
    case 'convertInboxToProject': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      // Nest under the chosen project, or fall back to Top level. Never nest into the item's own subtree.
      const valid =
        intent.parentId &&
        next.nodes[intent.parentId] &&
        !subtreeIds(next, intent.id).has(intent.parentId);
      const target = valid ? intent.parentId! : next.projectsNodeId;
      detach(next, intent.id);
      next.nodes[target]?.childIds.push(intent.id);
      node.project = true;
      if (intent.tags?.length) node.tags = normalizeTags([...node.tags, ...intent.tags]); // #920
      node.updatedAt = intent.now;
      return next;
    }
    case 'setStatus': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      if (intent.expectedStatus !== undefined && node.status !== intent.expectedStatus) return next;
      node.status = intent.status;
      // A finished action isn't being worked on: terminal statuses shed the in-progress system
      // tag (#716) — case-insensitively, since NamDesktop writes case variants (#654). A plain
      // restore never re-adds it; an UNDO of an accidental terminal change does (#724), carried
      // on the intent so fresh state, the expectedStatus guard, and conflict-replay all apply.
      if (intent.status === 'DONE' || intent.status === 'CANCELLED') {
        node.tags = node.tags.filter((tag) => canonicalTag(tag) !== IN_PROGRESS_TAG);
      } else if (intent.restoreInProgress && !node.tags.some((tag) => canonicalTag(tag) === IN_PROGRESS_TAG)) {
        node.tags = [...node.tags, IN_PROGRESS_TAG];
      }
      node.updatedAt = intent.now;
      node.statusChangedAt = intent.statusChangedAt === undefined ? intent.now : intent.statusChangedAt;
      return next;
    }
    case 'updateNode': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      node.title = intent.title;
      node.description = intent.description;
      node.updatedAt = intent.now;
      return next;
    }
    case 'setDue': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      node.dueAt = intent.dueAt;
      // Only touch the end / time when the intent carries them (callers that don't manage those omit
      // them, leaving any existing value intact). Clearing the start clears the range and the time.
      if (intent.dueEndAt !== undefined) node.dueEndAt = intent.dueEndAt;
      if (intent.dueTime !== undefined) node.dueTime = intent.dueTime;
      if (intent.dueEndTime !== undefined) node.dueEndTime = intent.dueEndTime;
      if (node.dueAt === null) {
        node.dueEndAt = null;
        node.dueTime = null;
      }
      // The end time is meaningless without an end date.
      if (!node.dueEndAt) node.dueEndTime = null;
      node.updatedAt = intent.now;
      return next;
    }
    case 'setDeriveDue': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      // Off = absent, so untouched documents stay byte-identical (additive contract, #706).
      if (intent.on) node.deriveDue = true;
      else delete node.deriveDue;
      node.updatedAt = intent.now;
      return next;
    }
    case 'updateTags': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      node.tags = normalizeTags(intent.tags);
      // The terminal-strip invariant holds here too (#724): the editor's tag field could
      // otherwise re-attach "in progress" to a finished item, with no row toggle to remove it.
      if (node.status === 'DONE' || node.status === 'CANCELLED') {
        node.tags = node.tags.filter((tag) => canonicalTag(tag) !== IN_PROGRESS_TAG);
      }
      node.updatedAt = intent.now;
      return next;
    }
    case 'registerTag': {
      // Add a standalone tag to the registered list (create-without-tagging).
      next.registeredTags = normalizeTags([...next.registeredTags, intent.tag]);
      return next;
    }
    case 'renameTag': {
      // Rewrite a tag across the registered list AND every node that uses it
      // (normalize merges it into the target if that already exists). Mirrors
      // NamDesktop's renameTag. System tags are protected (#651) — the UI hides the
      // controls; this guard keeps replayed/foreign intents from renaming them too.
      if (isSystemTag(intent.from)) return next;
      const from = intent.from.trim().toLowerCase();
      const to = intent.to.trim().toLowerCase();
      if (!from || !to || from === to) return next;
      next.registeredTags = normalizeTags(next.registeredTags.map((t) => (t === from ? to : t)));
      for (const node of Object.values(next.nodes)) {
        if (node.tags.includes(from)) node.tags = normalizeTags(node.tags.map((t) => (t === from ? to : t)));
      }
      // Carry each context's manual order (#1036) across the rename — otherwise a live context keeps
      // its nodes/bookmark but loses its hand-sorted order, and multi-tag orders orphan (#1036 review).
      next.viewOrders = renameTagInContextOrders(next.viewOrders, from, to);
      return next;
    }
    case 'deleteTag': {
      // Remove a tag from the registered list AND from every node that uses it.
      // Mirrors NamDesktop's deleteTag (the UI confirms with the usage count).
      // System tags are protected (#651), as above.
      if (isSystemTag(intent.tag)) return next;
      const tag = intent.tag.trim().toLowerCase();
      if (!tag) return next;
      next.registeredTags = next.registeredTags.filter((t) => t !== tag);
      for (const node of Object.values(next.nodes)) {
        if (node.tags.includes(tag)) node.tags = node.tags.filter((t) => t !== tag);
      }
      // A context that references the deleted tag can never be re-selected — drop its dead order (#1036).
      next.viewOrders = deleteTagInContextOrders(next.viewOrders, tag);
      return next;
    }
    case 'updateResources': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      node.resources = intent.resources;
      node.updatedAt = intent.now;
      return next;
    }
    case 'addAction': {
      if (!next.nodes[intent.parentId]) return next;
      next.nodes[intent.id] = {
        ...newNode(intent.id, intent.title, intent.now),
        status: intent.status,
        statusChangedAt: intent.now,
        // Optional scheduling at birth — the calendar's create-for-a-day flow (#681).
        dueAt: intent.dueAt ?? null,
        dueTime: intent.dueTime ?? null,
      };
      // Top by default (visible without scrolling a long list); bottom when the user prefers it.
      placeChild(next.nodes[intent.parentId], intent.id, intent.atTop);
      return next;
    }
    case 'addSubProject': {
      if (!next.nodes[intent.parentId]) return next;
      next.nodes[intent.id] = { ...newNode(intent.id, intent.title, intent.now), project: true };
      placeChild(next.nodes[intent.parentId], intent.id, intent.atTop);
      return next;
    }
    case 'moveNode': {
      const node = next.nodes[intent.id];
      const newParent = next.nodes[intent.newParentId];
      if (!node || !newParent || intent.id === intent.newParentId) return next;
      if (structuralIds(next).has(intent.id)) return next; // never move a container
      if (subtreeIds(next, intent.id).has(intent.newParentId)) return next; // no cycles
      detach(next, intent.id);
      newParent.childIds.push(intent.id);
      node.updatedAt = intent.now;
      return next;
    }
    case 'convertActionToProject': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      node.project = true;
      node.updatedAt = intent.now;
      // a free action becomes a top-level project — land it first so it's findable (#894), since the
      // convert happens away from the Projects list and you relate to it immediately after.
      if (parentOf(next, intent.id) === next.nextActionsNodeId) {
        detach(next, intent.id);
        const projects = next.nodes[next.projectsNodeId];
        if (projects) placeChild(projects, intent.id, true);
      }
      return next;
    }
    case 'convertProjectToAction': {
      const node = next.nodes[intent.id];
      if (!node || node.childIds.length > 0) return next; // leaf only
      node.project = false;
      delete node.deriveDue; // projects-only flag — off/irrelevant is absence (#711)
      node.status = intent.status;
      node.updatedAt = intent.now;
      node.statusChangedAt = intent.now;
      // a top-level project becomes a free action — land it first so it's findable (#894).
      if (parentOf(next, intent.id) === next.projectsNodeId) {
        detach(next, intent.id);
        const actions = next.nodes[next.nextActionsNodeId];
        if (actions) placeChild(actions, intent.id, true);
        // /next renders from `viewOrders.next` + node order, NOT childIds — applyViewOrder appends
        // ids missing from the saved order at the END, so the childIds unshift alone would leave the
        // arrival at the bottom (#902). Float it to the head of that saved order too, like
        // NextActionsPage pairs an add with a reorderView. A lone `[id]` still sorts first (the rest
        // are appended as "fresh"), so this works whether or not a prior order existed.
        const order = next.viewOrders['next'] ?? [];
        next.viewOrders = { ...next.viewOrders, next: [intent.id, ...order.filter((x) => x !== intent.id)] };
      }
      return next;
    }
    case 'incrementCountResource': {
      // The first interactive resource (#798): a +1 from the flow, no editor, no Save buffer.
      // Two modes (see the Intent type): PILL MODE (owner tap, `eventId` absent) guards on
      // `expectedValue` — a replay against a moved/shifted counter no-ops. LEDGER MODE (the guest
      // drain, `eventId` set) makes the apply idempotent: an id at/under the `drainedThrough`
      // watermark no-ops, else the delta CLAMPS (never no-ops) and the watermark advances past it.
      const node = next.nodes[intent.id];
      if (!node) return next;
      const resource = node.resources[intent.index];
      if (!resource || resource.type !== 'COUNT') return next;
      const drained = intent.eventId !== undefined;
      if (drained) {
        // Weak identity is the type check alone (no resource ids — #802/F4 accepted residue). An
        // event at or below the watermark is already applied: re-processing a leftover or a raced
        // claim must not double-count. The watermark only rises, so this can never re-open.
        if (intent.eventId! <= drainedThroughAt(node, intent.index)) return next;
      } else if (resource.value !== intent.expectedValue) {
        return next; // pill-mode stale guard (the #573 family)
      }
      const count = parseCount(resource.value);
      if (!count) return next;
      const delta = intent.delta ?? 1;
      // Both directions (#798 stock-keeping): +1 stops at the target, −1 stops at zero. Pill mode
      // no-ops at the boundary (nothing to record); ledger mode instead CLAMPS via formatCount and
      // still records, so the event terminates (never re-driven) even when it lands nothing.
      if (!drained) {
        if (delta > 0 && !count.unlimited && count.current >= count.target) return next;
        if (delta < 0 && count.current <= 0) return next;
      }
      const resources = node.resources.slice();
      const current = count.current + delta;
      resources[intent.index] = { ...resource, value: formatCount(current, count.target, count.unlimited) };
      const updated = { ...node, resources, updatedAt: intent.now };
      if (drained) updated.drainedThrough = advanceDrainedThrough(node.drainedThrough, intent.index, intent.eventId!);
      // The symmetric stock loop (#816, opt-in): a TICK CROSSING the goal boundary completes
      // the action; a tick crossing back below reopens it. Crossings, not thresholds
      // (#821/F1): a tick that stays on its side of the boundary never transitions — so a
      // deliberately reopened action isn't re-completed by an overshoot-zone tick, and a
      // hand-marked DONE below target isn't reopened by a mere decrement. Ticks only — hand
      // edits in the dialog never transition (editing is curation, ticking is doing).
      if (resource.completesAction) {
        const wasMet = count.current >= count.target;
        const isMet = current >= count.target;
        if (!wasMet && isMet && node.status !== 'DONE' && node.status !== 'CANCELLED' && node.status !== 'ARCHIVED') {
          updated.status = 'DONE';
          updated.statusChangedAt = intent.now;
          updated.tags = updated.tags.filter((tag) => canonicalTag(tag) !== IN_PROGRESS_TAG);
        } else if (wasMet && !isMet && node.status === 'DONE') {
          updated.status = 'NEXT';
          updated.statusChangedAt = intent.now;
        }
      }
      next.nodes[intent.id] = updated;
      return next;
    }
    case 'answerQuestionResource': {
      // The QUESTION resource (#827): a SET, not a toggle — the pill computes the toggle
      // (tap the active answer to clear) and sends the resulting desired state, so the
      // reducer and the guest drain both just apply it. Same two modes as the counter: PILL MODE
      // (`eventId` absent) guards on `expectedValue`; LEDGER MODE (`eventId` set) skips an
      // already-recorded id and otherwise SETs unconditionally, recording the event.
      const node = next.nodes[intent.id];
      if (!node) return next;
      const resource = node.resources[intent.index];
      if (!resource || resource.type !== 'QUESTION') return next;
      const drained = intent.eventId !== undefined;
      if (drained) {
        if (intent.eventId! <= drainedThroughAt(node, intent.index)) return next;
      } else if (resource.value !== intent.expectedValue) {
        return next;
      }
      if (!parseQuestion(resource.value)) return next;
      const answer = intent.answer === 'clear' ? null : intent.answer;
      const resources = node.resources.slice();
      resources[intent.index] = { ...resource, value: formatQuestion(answer) };
      const updated = { ...node, resources, updatedAt: intent.now };
      if (drained) updated.drainedThrough = advanceDrainedThrough(node.drainedThrough, intent.index, intent.eventId!);
      next.nodes[intent.id] = updated;
      return next;
    }
    case 'addPrerequisite': {
      if (!canAddPrerequisite(next, intent.actionId, intent.prereqId)) return next;
      next.nodes[intent.actionId].blockedBy.push(intent.prereqId);
      next.nodes[intent.actionId].updatedAt = intent.now;
      return next;
    }
    case 'removePrerequisite': {
      const action = next.nodes[intent.actionId];
      if (!action) return next;
      const i = action.blockedBy.indexOf(intent.prereqId);
      if (i === -1) return next;
      action.blockedBy.splice(i, 1);
      action.updatedAt = intent.now;
      return next;
    }
    case 'createSavedView': {
      // Replace an existing view of the same name, else append.
      next.savedViews = next.savedViews.filter((v) => v.name !== intent.name);
      next.savedViews.push({ name: intent.name, tags: intent.tags, nextOnly: intent.nextOnly });
      return next;
    }
    case 'renameSavedView': {
      next.savedViews = next.savedViews.map((v) =>
        v.name === intent.oldName ? { ...v, name: intent.newName } : v,
      );
      return next;
    }
    case 'deleteSavedView': {
      next.savedViews = next.savedViews.filter((v) => v.name !== intent.name);
      return next;
    }
    case 'addBookmark': {
      // Append; skip an exact duplicate id (replay-safe). The field may be absent on older docs.
      const existing = next.bookmarks ?? [];
      next.bookmarks = existing.some((b) => b.id === intent.bookmark.id)
        ? existing
        : [...existing, intent.bookmark];
      return next;
    }
    case 'removeBookmark': {
      next.bookmarks = (next.bookmarks ?? []).filter((b) => b.id !== intent.id);
      return next;
    }
    case 'renameBookmark': {
      // An empty label never lands (the dialog guards too — this covers replay/imports);
      // an unknown id is a tolerated no-op (removed on another device since).
      const label = intent.label.trim();
      if (!label) return next;
      next.bookmarks = (next.bookmarks ?? []).map((b) => (b.id === intent.id ? { ...b, label } : b));
      return next;
    }
    case 'reorderBookmarks': {
      // Persist a user-chosen bookmark order (#636): known ids in the given order (first
      // occurrence wins — a malformed/replayed order must not duplicate a bookmark, #645), then
      // anything the order doesn't mention (added on another device since) in their existing
      // relative order — same tolerance as reorderView. Pure and replay-safe.
      const existing = next.bookmarks ?? [];
      const mentioned = new Set(intent.order);
      const byId = new Map(existing.map((b) => [b.id, b]));
      const emitted = new Set<string>();
      next.bookmarks = [
        ...intent.order.flatMap((id) => {
          if (!byId.has(id) || emitted.has(id)) return [];
          emitted.add(id);
          return [byId.get(id)!];
        }),
        ...existing.filter((b) => !mentioned.has(b.id)),
      ];
      return next;
    }
    case 'reorderView': {
      // Persist a per-view manual order (a list of node ids). The lens reconciles it with the
      // live items at display time (new items appended, vanished ids ignored), so we just store
      // the order verbatim — pure and replay-safe.
      next.viewOrders = { ...next.viewOrders, [intent.view]: intent.order };
      return next;
    }
    case 'reorderChildren': {
      // Reorder a project's structural children (its `childIds`) — the order shared with the
      // desktop. The page computes the new full order (a permutation of the current childIds).
      //
      // RECONCILE, don't overwrite (#1141): the captured `order` is a snapshot. On a conflict this
      // intent is REPLAYED onto a freshly-pulled doc; storing it verbatim there would resurrect an
      // id a concurrent writer moved OUT of this project (aliasing it into two parents) or drop one
      // moved IN. So intersect the order with the *current* children (dedup), then append any current
      // child the order didn't mention (a concurrent add / move-in) at the tail. When `order` is a
      // clean permutation of the current childIds — the normal case — this is identity.
      const parent = next.nodes[intent.parentId];
      if (parent) {
        const current = new Set(parent.childIds);
        const placed = new Set<string>();
        const ordered = intent.order.filter((id) => current.has(id) && !placed.has(id) && placed.add(id));
        const rest = parent.childIds.filter((id) => !placed.has(id));
        parent.childIds = [...ordered, ...rest];
      }
      return next;
    }
    case 'createMissionControl': {
      next.missionControls = next.missionControls.filter((m) => m.name !== intent.name);
      next.missionControls.push({ name: intent.name, tags: intent.tags });
      return next;
    }
    case 'deleteMissionControl': {
      next.missionControls = next.missionControls.filter((m) => m.name !== intent.name);
      return next;
    }
    case 'saveAsTemplate': {
      if (!next.nodes[intent.nodeId]) return next;
      // The template is the node's CHILDREN; capture the whole subtree's ids so within-template
      // prerequisites survive (a blocker to the captured root itself drops on apply, #863).
      const captured = subtreeIds(next, intent.nodeId);
      captured.delete(intent.nodeId);
      next.templates = next.templates.filter((t) => t.name !== intent.name);
      next.templates.push({ name: intent.name, children: toTemplateNodes(next, intent.nodeId, captured) });
      return next;
    }
    case 'deleteTemplate': {
      next.templates = next.templates.filter((t) => t.name !== intent.name);
      return next;
    }
    case 'applyTemplate': {
      if (!next.nodes[intent.parentId]) return next;
      // #863: templates now carry rich nodes, so applying is exactly seeding (insertSeed reproduces
      // status/tags/due/resources/description + remapped blockers).
      insertSeed(next, intent.parentId, intent.nodes, intent.now);
      return next;
    }
    case 'seedProject': {
      if (!next.nodes[intent.parentId]) return next;
      insertSeed(next, intent.parentId, intent.nodes, intent.now);
      // atTop (#864): float the seeded top-level nodes to the FRONT of the parent (preserving their
      // order), so a project created from a template lands first and needs no scrolling to find.
      // insertSeed itself always appends; this only reorders this level. Import omits atTop → appends.
      if (intent.atTop) {
        const parent = next.nodes[intent.parentId];
        const seeded = new Set(intent.nodes.map((n) => n.id));
        if (parent) parent.childIds = [...intent.nodes.map((n) => n.id), ...parent.childIds.filter((id) => !seeded.has(id))];
      }
      return next;
    }
    case 'groupIntoSubProject': {
      // Create a new sub-project under `parentId`, then move the selected actions into it.
      const parent = next.nodes[intent.parentId];
      if (!parent) return next;
      next.nodes[intent.subProjectId] = {
        ...newNode(intent.subProjectId, intent.title, intent.now),
        project: true,
      };
      // Prepend the new sub-project so it lands first, like other freshly-created nodes.
      parent.childIds.unshift(intent.subProjectId);
      for (const actionId of intent.actionIds) {
        if (!next.nodes[actionId]) continue;
        detach(next, actionId);
        next.nodes[intent.subProjectId].childIds.push(actionId);
      }
      return next;
    }
    case 'deleteRecursive': {
      if (!next.nodes[intent.id]) return next;
      const subtree = subtreeIds(next, intent.id);
      detach(next, intent.id);
      for (const id of subtree) delete next.nodes[id];
      // drop any blockedBy references to the removed nodes
      for (const node of Object.values(next.nodes)) {
        node.blockedBy = node.blockedBy.filter((b) => !subtree.has(b));
      }
      return next;
    }
    case 'deleteLeaf': {
      if (!next.nodes[intent.id]) return next;
      detach(next, intent.id);
      delete next.nodes[intent.id];
      return next;
    }
    case 'restoreNodes': {
      const { nodes, parentId, index, blockedRefs } = intent.capture;
      const root = nodes[0];
      if (!root || next.nodes[root.id]) return next; // nothing to restore, or already back
      for (const node of nodes) next.nodes[node.id] = structuredClone(node);
      const parent = next.nodes[parentId] ?? next.nodes[next.rootNodeId];
      if (parent && !parent.childIds.includes(root.id)) {
        parent.childIds.splice(Math.min(index, parent.childIds.length), 0, root.id);
      }
      // Re-attach external blockedBy links that the delete stripped.
      for (const ref of blockedRefs) {
        const n = next.nodes[ref.nodeId];
        if (n && !n.blockedBy.includes(ref.blockedId)) n.blockedBy.push(ref.blockedId);
      }
      return next;
    }
  }
}
