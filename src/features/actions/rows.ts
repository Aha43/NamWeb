import type { NamNode, NodeStatus, WorkspaceDocument } from '../../domain/types';
import { projectPath } from '../../domain/lenses';

/** Flattened action view-model shared by the Next Actions, Backlog, and Workbench lists. */
export interface ActionRowData {
  id: string;
  title: string;
  status: NodeStatus;
  path: string[];
  tags: string[];
  dueAt: string | null;
  /** For the age hint — updatedAt falling back to createdAt. */
  touchedAt: string | null;
}

export function toActionRow(doc: WorkspaceDocument, node: NamNode): ActionRowData {
  return {
    id: node.id,
    title: node.title,
    status: node.status,
    path: projectPath(doc, node.id),
    tags: node.tags,
    dueAt: node.dueAt,
    touchedAt: node.updatedAt ?? node.createdAt,
  };
}
