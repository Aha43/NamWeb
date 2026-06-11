import type { WorkspaceDocument } from '@/domain/types';
import { subtreeIds } from '@/domain/lenses';

/** Roll-up stats for one sub-project, for the workbench heat-map. */
export interface MissionStat {
  id: string;
  title: string;
  subProjectCount: number;
  done: number;
  total: number;
  /** done / total descendant actions; 1 when there are no actions. */
  ratio: number;
}

/** Per-direct-sub-project roll-ups under `projectId`. Mirrors NamDesktop's MissionControlLens. */
export function missionStats(doc: WorkspaceDocument, projectId: string): MissionStat[] {
  const project = doc.nodes[projectId];
  if (!project) return [];
  return project.childIds
    .map((id) => doc.nodes[id])
    .filter((n) => n?.project)
    .map((sub) => {
      let done = 0;
      let total = 0;
      let subProjectCount = 0;
      for (const id of subtreeIds(doc, sub.id)) {
        if (id === sub.id) continue;
        const node = doc.nodes[id];
        if (!node) continue;
        if (node.project) subProjectCount += 1;
        else {
          total += 1;
          if (node.status === 'DONE') done += 1;
        }
      }
      return { id: sub.id, title: sub.title, subProjectCount, done, total, ratio: total === 0 ? 1 : done / total };
    });
}
