// Factory for a brand-new, empty workspace document — the web counterpart to
// NamDesktop's `NamWorkspace.createDefault()`. A self-serve web user has no
// desktop app to seed the first `workspaces` row, so the web app bootstraps one
// itself. The shape must match desktop's `createDefault()` exactly (root "NAM"
// with Inbox / Projects / Actions children, formatVersion 1) so NamDesktop
// cloud-sync can read and extend the same row later.
//
// Source of truth: NamDesktop `model/NamWorkspace.createDefault()` +
// `persist/JsonWorkspaceRepository.FORMAT_VERSION`.

import { newId } from '../lib/local';
import type { NamNode, WorkspaceDocument } from './types';

const FORMAT_VERSION = 1;

/** A structural node (root or a fixed top-level bucket) with desktop defaults. */
function structuralNode(id: string, title: string, childIds: string[] = []): NamNode {
  return {
    id,
    title,
    description: null,
    status: 'BACKLOG',
    project: false,
    childIds,
    tags: [],
    blockedBy: [],
    resources: [],
    createdAt: null,
    updatedAt: null,
    statusChangedAt: null,
    dueAt: null,
  };
}

/**
 * Build a fresh, empty workspace document — mirrors NamDesktop `createDefault()`.
 * Root "NAM" holds the three fixed buckets: Inbox, Projects, Actions.
 */
export function createDefaultWorkspace(): WorkspaceDocument {
  const rootId = newId();
  const inboxId = newId();
  const projectsId = newId();
  const nextActionsId = newId();

  const nodes: Record<string, NamNode> = {
    [rootId]: structuralNode(rootId, 'NAM', [inboxId, projectsId, nextActionsId]),
    [inboxId]: structuralNode(inboxId, 'Inbox'),
    [projectsId]: structuralNode(projectsId, 'Projects'),
    [nextActionsId]: structuralNode(nextActionsId, 'Actions'),
  };

  return {
    formatVersion: FORMAT_VERSION,
    rootNodeId: rootId,
    inboxNodeId: inboxId,
    projectsNodeId: projectsId,
    nextActionsNodeId: nextActionsId,
    nodes,
    registeredTags: [],
    savedViews: [],
    missionControls: [],
    templates: [],
    viewOrders: {},
  };
}
