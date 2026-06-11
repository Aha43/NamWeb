import type { NamNode, WorkspaceDocument } from '../../domain/types';
import { projectPath } from '../../domain/lenses';

/** Flattened action view-model shared by the Next Actions and Backlog panels. */
export interface ActionRowData {
  id: string;
  title: string;
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
    path: projectPath(doc, node.id),
    tags: node.tags,
    dueAt: node.dueAt,
    touchedAt: node.updatedAt ?? node.createdAt,
  };
}
