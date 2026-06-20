// Import another workspace's JSON export into the current one, grafted under a single timestamped
// project (no smart merge — you rearrange after). Everything is re-id'd fresh (collision-safe) and
// blocker links are remapped to the new ids; built as a `SeedNode` tree for the `seedProject` intent.
// Pure + React-free.

import type { NamNode, WorkspaceDocument } from './types';
import type { SeedNode } from './mutations';

/** Parse + lightly validate a workspace export. Returns null if it isn't a NAM workspace document. */
export function parseWorkspaceJson(text: string): WorkspaceDocument | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!d.nodes || typeof d.nodes !== 'object') return null;
  const nodes = d.nodes as Record<string, unknown>;
  for (const key of ['rootNodeId', 'inboxNodeId', 'projectsNodeId', 'nextActionsNodeId'] as const) {
    const id = d[key];
    if (typeof id !== 'string' || !nodes[id]) return null;
  }
  return d as unknown as WorkspaceDocument;
}

/** Two-digit pad. */
const p2 = (n: number): string => String(n).padStart(2, '0');

/** `import-YYYY-MM-DD-HH-MM-SS` — collision-safe container name. */
export function importProjectName(now: Date): string {
  return `import-${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}-${p2(now.getHours())}-${p2(now.getMinutes())}-${p2(now.getSeconds())}`;
}

/**
 * Build the import-project `SeedNode` from a (validated) source workspace: its top-level projects
 * become sub-projects, its free/Next actions + Inbox items become direct actions, everything else
 * identical. Fresh ids throughout; `blockedBy` remapped to the new ids (dangling refs dropped).
 */
export function buildImportSeed(source: WorkspaceDocument, newId: () => string, now: Date): SeedNode {
  // Containers whose *children* we import (projects first, then free actions, then inbox).
  const containerIds = [source.projectsNodeId, source.nextActionsNodeId, source.inboxNodeId];
  const topChildIds: string[] = [];
  for (const cid of containerIds) {
    const container = source.nodes[cid];
    if (container) topChildIds.push(...container.childIds.filter((id) => source.nodes[id]));
  }

  // Pre-assign fresh ids for every node we'll import (so blocker remapping can resolve forward refs).
  const idMap = new Map<string, string>();
  const assign = (oldId: string) => {
    const n = source.nodes[oldId];
    if (!n || idMap.has(oldId)) return;
    idMap.set(oldId, newId());
    for (const child of n.childIds) assign(child);
  };
  for (const id of topChildIds) assign(id);

  const convert = (oldId: string): SeedNode | null => {
    const n: NamNode | undefined = source.nodes[oldId];
    if (!n) return null;
    return {
      id: idMap.get(oldId)!,
      title: n.title,
      description: n.description,
      project: n.project,
      status: n.status,
      tags: n.tags,
      dueAt: n.dueAt,
      blockedBy: n.blockedBy.map((b) => idMap.get(b)).filter((x): x is string => Boolean(x)),
      resources: n.resources,
      children: n.childIds.map(convert).filter((x): x is SeedNode => x !== null),
    };
  };

  return {
    id: newId(),
    title: importProjectName(now),
    project: true,
    children: topChildIds.map(convert).filter((x): x is SeedNode => x !== null),
  };
}

export type ImportResult = { ok: true; seed: SeedNode } | { ok: false; error: string };

/** Parse + build in one step for the UI; returns a clear error instead of throwing. */
export function importSeedFromJson(text: string, newId: () => string, now: Date): ImportResult {
  const source = parseWorkspaceJson(text);
  if (!source) return { ok: false, error: "That file isn't a valid NAM workspace export." };
  return { ok: true, seed: buildImportSeed(source, newId, now) };
}
