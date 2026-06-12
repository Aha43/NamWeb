// Intent-based mutations on the workspace document. Each `Intent` is a small,
// named, self-contained operation carrying any locally-generated values (ids,
// timestamps) so it can be *replayed* onto a freshly pulled document during the
// sync conflict-retry. All functions are pure: they return a new document and
// never mutate the input. Mirrors NamDesktop `NamWorkspaceService`.

import type { NamNode, NodeStatus, WorkspaceDocument } from './types';
import { canAddPrerequisite, subtreeIds } from './lenses';

export type Intent =
  | { type: 'addInboxItem'; id: string; title: string; now: string }
  | { type: 'convertInboxToNext'; id: string; now: string }
  | { type: 'convertInboxToAction'; id: string; status: NodeStatus; now: string }
  | { type: 'convertInboxToProject'; id: string; now: string }
  | { type: 'setStatus'; id: string; status: NodeStatus; now: string }
  | { type: 'updateNode'; id: string; title: string; description: string | null; now: string }
  | { type: 'setDue'; id: string; dueAt: string | null; now: string }
  | { type: 'updateTags'; id: string; tags: string[]; now: string }
  | { type: 'addAction'; parentId: string; id: string; title: string; status: NodeStatus; now: string }
  | { type: 'addSubProject'; parentId: string; id: string; title: string; now: string }
  | { type: 'moveNode'; id: string; newParentId: string; now: string }
  | { type: 'convertActionToProject'; id: string; now: string }
  | { type: 'convertProjectToAction'; id: string; status: NodeStatus; now: string }
  | { type: 'addPrerequisite'; actionId: string; prereqId: string; now: string }
  | { type: 'removePrerequisite'; actionId: string; prereqId: string; now: string }
  | { type: 'createSavedView'; name: string; tags: string[]; nextOnly: boolean }
  | { type: 'renameSavedView'; oldName: string; newName: string }
  | { type: 'deleteSavedView'; name: string }
  | { type: 'createMissionControl'; name: string; tags: string[] }
  | { type: 'deleteMissionControl'; name: string }
  | { type: 'deleteRecursive'; id: string }
  | { type: 'deleteLeaf'; id: string };

/** Trimmed, lower-cased, de-duplicated, non-empty — mirrors NamDesktop tag handling. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
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

/** The id of whichever node lists `id` as a child, or undefined. */
function parentOf(doc: WorkspaceDocument, id: string): string | undefined {
  for (const node of Object.values(doc.nodes)) {
    if (node.childIds.includes(id)) return node.id;
  }
  return undefined;
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
    intent.type === 'deleteMissionControl'
  ) {
    return true; // operate on a document-level list, not a node
  }
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
    case 'convertInboxToAction': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      detach(next, intent.id);
      next.nodes[next.nextActionsNodeId]?.childIds.push(intent.id);
      node.project = false;
      node.status = intent.status;
      node.updatedAt = intent.now;
      node.statusChangedAt = intent.now;
      return next;
    }
    case 'convertInboxToProject': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      detach(next, intent.id);
      next.nodes[next.projectsNodeId]?.childIds.push(intent.id);
      node.project = true;
      node.updatedAt = intent.now;
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
      node.updatedAt = intent.now;
      return next;
    }
    case 'updateTags': {
      const node = next.nodes[intent.id];
      if (!node) return next;
      node.tags = normalizeTags(intent.tags);
      node.updatedAt = intent.now;
      return next;
    }
    case 'addAction': {
      if (!next.nodes[intent.parentId]) return next;
      next.nodes[intent.id] = {
        ...newNode(intent.id, intent.title, intent.now),
        status: intent.status,
        statusChangedAt: intent.now,
      };
      next.nodes[intent.parentId].childIds.push(intent.id);
      return next;
    }
    case 'addSubProject': {
      if (!next.nodes[intent.parentId]) return next;
      next.nodes[intent.id] = { ...newNode(intent.id, intent.title, intent.now), project: true };
      next.nodes[intent.parentId].childIds.push(intent.id);
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
      // a free action becomes a top-level project
      if (parentOf(next, intent.id) === next.nextActionsNodeId) {
        detach(next, intent.id);
        next.nodes[next.projectsNodeId]?.childIds.push(intent.id);
      }
      return next;
    }
    case 'convertProjectToAction': {
      const node = next.nodes[intent.id];
      if (!node || node.childIds.length > 0) return next; // leaf only
      node.project = false;
      node.status = intent.status;
      node.updatedAt = intent.now;
      node.statusChangedAt = intent.now;
      // a top-level project becomes a free action
      if (parentOf(next, intent.id) === next.projectsNodeId) {
        detach(next, intent.id);
        next.nodes[next.nextActionsNodeId]?.childIds.push(intent.id);
      }
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
    case 'createMissionControl': {
      next.missionControls = next.missionControls.filter((m) => m.name !== intent.name);
      next.missionControls.push({ name: intent.name, tags: intent.tags });
      return next;
    }
    case 'deleteMissionControl': {
      next.missionControls = next.missionControls.filter((m) => m.name !== intent.name);
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
  }
}
