import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { subtreeIds } from '@/domain/lenses';

/** Roll-up stats for one project — done/total descendant actions + sub-project count. */
export interface ProjectRollup {
  subProjectCount: number;
  done: number;
  total: number;
  /** done / total descendant actions; 1 when there are no actions. */
  ratio: number;
}

export interface MissionStat extends ProjectRollup {
  id: string;
  title: string;
}

/** Roll up the descendant actions/sub-projects of a single project. */
export function projectRollup(doc: WorkspaceDocument, projectId: string): ProjectRollup {
  let done = 0;
  let total = 0;
  let subProjectCount = 0;
  for (const id of subtreeIds(doc, projectId)) {
    if (id === projectId) continue;
    const node = doc.nodes[id];
    if (!node) continue;
    if (node.project) subProjectCount += 1;
    else {
      total += 1;
      if (node.status === 'DONE') done += 1;
    }
  }
  return { subProjectCount, done, total, ratio: total === 0 ? 1 : done / total };
}

/** Done-ratio border colour for a heat-map card: red < 34% ≤ amber < 67% ≤ green. */
export function ratioBorderClass(ratio: number): string {
  if (ratio < 0.34) return 'border-red-500/60';
  if (ratio < 0.67) return 'border-amber-500/60';
  return 'border-green-500/60';
}

/**
 * Heat-map border colour for a roll-up. An empty card (no actions) is **neutral**, not green —
 * "nothing to do here" isn't "all done". Otherwise it's the done-ratio colour.
 */
export function heatBorderClass(stat: { total: number; ratio: number }): string {
  if (stat.total === 0) return 'border-border';
  return ratioBorderClass(stat.ratio);
}

/**
 * Heat-map cards under `projectId`: the project's own direct actions get an "Unsorted" card
 * (omitted when it has none — mirrors the Column view's leading column), followed by one card per
 * direct sub-project (rolled up over its whole subtree).
 */
export function missionStats(doc: WorkspaceDocument, projectId: string): MissionStat[] {
  const project = doc.nodes[projectId];
  if (!project) return [];
  const children = project.childIds
    .map((id) => doc.nodes[id])
    .filter((n): n is NamNode => Boolean(n));

  const stats: MissionStat[] = [];

  // The project's own loose actions, as their own box (only when there are any).
  const ownActions = children.filter((n) => !n.project);
  if (ownActions.length > 0) {
    const done = ownActions.filter((n) => n.status === 'DONE').length;
    stats.push({
      id: projectId,
      title: 'Unsorted',
      subProjectCount: 0,
      done,
      total: ownActions.length,
      ratio: done / ownActions.length,
    });
  }

  for (const sub of children.filter((n) => n.project)) {
    stats.push({ id: sub.id, title: sub.title, ...projectRollup(doc, sub.id) });
  }
  return stats;
}
