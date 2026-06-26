// Pure helpers for the Miller-columns project picker (ProjectPickerDialog). Kept separate from the
// component so the column-building and selectable/greyed logic is unit-testable over a plain doc.

import { archivedProjectIds, projects, subProjects } from '@/domain/lenses';
import type { NamNode, WorkspaceDocument } from '@/domain/types';

/** A destination the caller offers: a project id, or a container/sentinel ("Free actions" etc.). */
export interface PickerTarget {
  id: string;
  label: string;
}

/** One row in a picker column. */
export interface PickerItem {
  id: string;
  label: string;
  /** Has non-archived sub-projects to open in the next column. */
  hasChildren: boolean;
  /** A valid destination (its id is in the caller's target set) — otherwise shown greyed. */
  selectable: boolean;
  /** A special root (a container/sentinel like "Free actions"), not a real project node. */
  isSpecial: boolean;
}

function toItem(
  doc: WorkspaceDocument,
  node: NamNode,
  allowed: Set<string>,
  archived: Set<string>,
): PickerItem {
  return {
    id: node.id,
    label: node.title,
    hasChildren: subProjects(doc, node.id).some((c) => !archived.has(c.id)),
    selectable: allowed.has(node.id),
    isSpecial: false,
  };
}

/**
 * Special-root entries among the targets: those whose id is **not** a real project node
 * (containers / sentinels such as "Free actions" / "Top level" / "Inbox"). Always selectable;
 * rendered at the top of column 0.
 */
export function specialRoots(doc: WorkspaceDocument, targets: PickerTarget[]): PickerItem[] {
  return targets
    .filter((t) => !doc.nodes[t.id]?.project)
    .map((t) => ({ id: t.id, label: t.label, hasChildren: false, selectable: true, isSpecial: true }));
}

/** Column 0: special roots first, then the top-level projects (archived excluded). */
export function rootColumn(
  doc: WorkspaceDocument,
  targets: PickerTarget[],
  allowed: Set<string>,
): PickerItem[] {
  const archived = archivedProjectIds(doc);
  const top = projects(doc)
    .filter((p) => !archived.has(p.id))
    .map((p) => toItem(doc, p, allowed, archived));
  return [...specialRoots(doc, targets), ...top];
}

/** The sub-projects column under `parentId` (archived excluded). */
export function childColumn(
  doc: WorkspaceDocument,
  parentId: string,
  allowed: Set<string>,
): PickerItem[] {
  const archived = archivedProjectIds(doc);
  return subProjects(doc, parentId)
    .filter((s) => !archived.has(s.id))
    .map((s) => toItem(doc, s, allowed, archived));
}
