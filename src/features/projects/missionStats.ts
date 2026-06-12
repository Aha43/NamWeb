import type { WorkspaceDocument } from '@/domain/types';
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

/** Per-direct-sub-project roll-ups under `projectId`, for the workbench heat-map. */
export function missionStats(doc: WorkspaceDocument, projectId: string): MissionStat[] {
  const project = doc.nodes[projectId];
  if (!project) return [];
  return project.childIds
    .map((id) => doc.nodes[id])
    .filter((n) => n?.project)
    .map((sub) => ({ id: sub.id, title: sub.title, ...projectRollup(doc, sub.id) }));
}
