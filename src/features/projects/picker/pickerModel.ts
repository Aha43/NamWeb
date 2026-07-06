// Pure helpers for the Miller-columns project picker (ProjectPickerDialog). Kept separate from the
// component so the column-building and selectable/greyed logic is unit-testable over a plain doc.

import {
  archivedNodeIds,
  archivedProjectIds,
  projectActions,
  projects,
  structuralNodeIds,
  subProjects,
} from '@/domain/lenses';
import type { NamNode, WorkspaceDocument } from '@/domain/types';

/** A destination the caller offers: a project/action id, or a container/sentinel ("Free actions"). */
export interface PickerTarget {
  id: string;
  label: string;
}

/**
 * What the browser lists (#657) — like a system file dialog: `projects` = folders only (the
 * original picker), `actions`/`both` = actions appear as chevron-less leaves ("files") after the
 * sub-projects. What's *selectable* is always the caller's `targets`; the mode only controls
 * what is shown to browse.
 */
export type PickerMode = 'projects' | 'actions' | 'both';

/** One row in a picker column. */
export interface PickerItem {
  id: string;
  label: string;
  /** Has non-archived children to open in the next column (in the current mode). */
  hasChildren: boolean;
  /** A valid destination (its id is in the caller's target set) — otherwise shown greyed. */
  selectable: boolean;
  /** A special root (a container/sentinel like "Free actions"), not a real project/action node. */
  isSpecial: boolean;
  /** Row kind — mixed modes render folder/file icons off this. */
  kind: 'project' | 'action' | 'special';
}

/** Actions listed under a project: open work only (DONE/CANCELLED and archived subtrees hidden). */
function listableActions(doc: WorkspaceDocument, parentId: string, archivedNodes: Set<string>): NamNode[] {
  return projectActions(doc, parentId).filter(
    (a) => !archivedNodes.has(a.id) && a.status !== 'DONE' && a.status !== 'CANCELLED',
  );
}

function toProjectItem(
  doc: WorkspaceDocument,
  node: NamNode,
  allowed: Set<string>,
  archived: Set<string>,
  mode: PickerMode,
  archivedNodes: Set<string>,
): PickerItem {
  const hasSubProjects = subProjects(doc, node.id).some((c) => !archived.has(c.id));
  const hasActions = mode !== 'projects' && listableActions(doc, node.id, archivedNodes).length > 0;
  return {
    id: node.id,
    label: node.title,
    hasChildren: hasSubProjects || hasActions,
    selectable: allowed.has(node.id),
    isSpecial: false,
    kind: 'project',
  };
}

function toActionItem(node: NamNode, allowed: Set<string>): PickerItem {
  return {
    id: node.id,
    label: node.title,
    hasChildren: false,
    selectable: allowed.has(node.id),
    isSpecial: false,
    kind: 'action',
  };
}

/**
 * Special-root entries among the targets: containers/sentinels ("Free actions" / "Top level" /
 * the `''` default) — ids that aren't real project/action nodes. Always selectable; rendered at
 * the top of column 0. (Structural containers are real nodes but not pickable content — the
 * kind-aware test matters now that actions can be ordinary rows, #657.)
 */
export function specialRoots(doc: WorkspaceDocument, targets: PickerTarget[]): PickerItem[] {
  const structural = structuralNodeIds(doc);
  return targets
    .filter((t) => !doc.nodes[t.id] || structural.has(t.id))
    .map((t) => ({
      id: t.id,
      label: t.label,
      hasChildren: false,
      selectable: true,
      isSpecial: true,
      kind: 'special' as const,
    }));
}

/** Column 0: special roots, then top-level projects, then (in actions/both) the free actions. */
export function rootColumn(
  doc: WorkspaceDocument,
  targets: PickerTarget[],
  allowed: Set<string>,
  mode: PickerMode = 'projects',
): PickerItem[] {
  const archived = archivedProjectIds(doc);
  const archivedNodes = mode === 'projects' ? new Set<string>() : archivedNodeIds(doc);
  const top = projects(doc)
    .filter((p) => !archived.has(p.id))
    .map((p) => toProjectItem(doc, p, allowed, archived, mode, archivedNodes));
  const free =
    mode === 'projects'
      ? []
      : listableActions(doc, doc.nextActionsNodeId, archivedNodes).map((a) => toActionItem(a, allowed));
  return [...specialRoots(doc, targets), ...top, ...free];
}

/** The children column under `parentId`: sub-projects (archived excluded), then the actions. */
export function childColumn(
  doc: WorkspaceDocument,
  parentId: string,
  allowed: Set<string>,
  mode: PickerMode = 'projects',
): PickerItem[] {
  const archived = archivedProjectIds(doc);
  const archivedNodes = mode === 'projects' ? new Set<string>() : archivedNodeIds(doc);
  const subs = subProjects(doc, parentId)
    .filter((s) => !archived.has(s.id))
    .map((s) => toProjectItem(doc, s, allowed, archived, mode, archivedNodes));
  const acts =
    mode === 'projects' ? [] : listableActions(doc, parentId, archivedNodes).map((a) => toActionItem(a, allowed));
  return [...subs, ...acts];
}
