import type { NamNode, NodeStatus, WorkspaceDocument } from '../../domain/types';
import { buildPath, effectiveTags, subtreeIds } from '../../domain/lenses';
import type { ProjectPathSegment } from './ProjectPathLinks';

/** Flattened action view-model shared by the Next Actions, Backlog, and Workbench lists. */
export interface ActionRowData {
  id: string;
  title: string;
  /** Free-text notes — shown as a row tooltip (truncated) when present. */
  description: string | null;
  status: NodeStatus;
  /** Ancestor projects (top-most first) — id + title so each can link to its project. */
  path: ProjectPathSegment[];
  tags: string[];
  /** Tags inherited from ancestor projects ("rubbed off") — shown italic, can't be edited here. */
  inheritedTags?: string[];
  dueAt: string | null;
  /** Optional end of a date range (inclusive); a range when set with `dueAt` and `>= dueAt`. */
  dueEndAt?: string | null;
  /** For the age hint — updatedAt falling back to createdAt. */
  touchedAt: string | null;
  /** True when the node has attached resources (shows a paperclip). */
  hasResources?: boolean;
  /** Descendant count (0 for a leaf) — drives the delete-confirm message. */
  descendantCount?: number;
}

/** The row title's hover tooltip: the node's notes, trimmed and length-capped — or undefined when
 *  there are none (so no tooltip is armed). */
export function descriptionTooltip(description: string | null): string | undefined {
  const trimmed = description?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 200 ? `${trimmed.slice(0, 199)}…` : trimmed;
}

export function toActionRow(doc: WorkspaceDocument, node: NamNode): ActionRowData {
  return {
    id: node.id,
    title: node.title,
    description: node.description,
    status: node.status,
    path: buildPath(doc, node.id).map((n) => ({ id: n.id, title: n.title })),
    tags: node.tags,
    inheritedTags: effectiveTags(doc, node.id).filter((t) => !node.tags.includes(t)),
    dueAt: node.dueAt,
    dueEndAt: node.dueEndAt ?? null,
    touchedAt: node.updatedAt ?? node.createdAt,
    hasResources: node.resources.length > 0,
    descendantCount: subtreeIds(doc, node.id).size - 1,
  };
}
