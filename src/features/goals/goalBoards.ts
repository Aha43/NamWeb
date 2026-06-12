import type { MissionControl, WorkspaceDocument } from '@/domain/types';
import { buildPath } from '@/domain/lenses';
import { projectRollup, type MissionStat } from '../projects/missionStats';

/**
 * Projects matching ANY of a Goal Board's tags (OR), de-duplicated so a parent is
 * shown once even if a descendant also matches, each with roll-up stats. Mirrors
 * NamDesktop's MissionControlLens.
 */
export function missionControlStations(doc: WorkspaceDocument, board: MissionControl): MissionStat[] {
  const tagset = new Set(board.tags);
  const matching = Object.values(doc.nodes).filter(
    (n) => n.project && n.tags.some((t) => tagset.has(t)),
  );
  const matchingIds = new Set(matching.map((n) => n.id));
  // Drop a matching project that has a matching ancestor (show the top-most only).
  const shown = matching.filter((n) => !buildPath(doc, n.id).some((a) => matchingIds.has(a.id)));
  return shown.map((p) => ({ id: p.id, title: p.title, ...projectRollup(doc, p.id) }));
}
