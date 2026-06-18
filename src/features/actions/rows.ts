import type { NamNode, NodeStatus, WorkspaceDocument } from '../../domain/types';
import { buildPath, subtreeIds } from '../../domain/lenses';
import type { ProjectPathSegment } from './ProjectPathLinks';

/** Flattened action view-model shared by the Next Actions, Backlog, and Workbench lists. */
export interface ActionRowData {
  id: string;
  title: string;
  status: NodeStatus;
  /** Ancestor projects (top-most first) — id + title so each can link to its project. */
  path: ProjectPathSegment[];
  tags: string[];
  dueAt: string | null;
  /** For the age hint — updatedAt falling back to createdAt. */
  touchedAt: string | null;
  /** True when the node has attached resources (shows a paperclip). */
  hasResources?: boolean;
  /** Descendant count (0 for a leaf) — drives the delete-confirm message. */
  descendantCount?: number;
}

export function toActionRow(doc: WorkspaceDocument, node: NamNode): ActionRowData {
  return {
    id: node.id,
    title: node.title,
    status: node.status,
    path: buildPath(doc, node.id).map((n) => ({ id: n.id, title: n.title })),
    tags: node.tags,
    dueAt: node.dueAt,
    touchedAt: node.updatedAt ?? node.createdAt,
    hasResources: node.resources.length > 0,
    descendantCount: subtreeIds(doc, node.id).size - 1,
  };
}
