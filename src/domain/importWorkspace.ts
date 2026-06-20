// Import another workspace's JSON export into the current one, grafted under a single timestamped
// project (no smart merge — you rearrange after). Everything is re-id'd fresh (collision-safe) and
// blocker links are remapped to the new ids; built as a `SeedNode` tree for the `seedProject` intent.
// Accepts both the account "Export my data" bundle ({ workspaces: [{ name, document }] }) and a bare
// workspace document. Pure + React-free.

import type { NamNode, WorkspaceDocument } from './types';
import type { SeedNode } from './mutations';

interface NamedWorkspace {
  name: string;
  doc: WorkspaceDocument;
}

/** Does this look like a workspace document (nodes + the four structural ids that exist in nodes)? */
function isWorkspaceDoc(value: unknown): value is WorkspaceDocument {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  if (!d.nodes || typeof d.nodes !== 'object') return false;
  const nodes = d.nodes as Record<string, unknown>;
  return (['rootNodeId', 'inboxNodeId', 'projectsNodeId', 'nextActionsNodeId'] as const).every(
    (k) => typeof d[k] === 'string' && Boolean(nodes[d[k] as string]),
  );
}

/**
 * Parse + validate an import file into one or more named workspace documents. Accepts the export
 * **bundle** (`{ workspaces: [{ name, document }] }`) or a bare workspace document. Returns null if
 * nothing usable is found.
 */
export function parseImport(text: string): NamedWorkspace[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  // Export bundle: pull each workspace's `document`.
  if (Array.isArray(d.workspaces)) {
    const out: NamedWorkspace[] = [];
    for (const w of d.workspaces as Array<Record<string, unknown>>) {
      if (w && isWorkspaceDoc(w.document)) {
        out.push({ name: typeof w.name === 'string' ? w.name : '', doc: w.document });
      }
    }
    return out.length > 0 ? out : null;
  }

  // Bare workspace document.
  if (isWorkspaceDoc(d)) return [{ name: '', doc: d as unknown as WorkspaceDocument }];
  return null;
}

const p2 = (n: number): string => String(n).padStart(2, '0');

/** `import-YYYY-MM-DD-HH-MM-SS` — collision-safe container name. */
export function importProjectName(now: Date): string {
  return `import-${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}-${p2(now.getHours())}-${p2(now.getMinutes())}-${p2(now.getSeconds())}`;
}

/** Convert one workspace's top-level content (projects + free/Next actions + Inbox) to SeedNodes,
 *  fresh ids throughout, blockedBy remapped to the new ids (dangling refs dropped). */
function workspaceContent(source: WorkspaceDocument, newId: () => string): SeedNode[] {
  const containerIds = [source.projectsNodeId, source.nextActionsNodeId, source.inboxNodeId];
  const topChildIds: string[] = [];
  for (const cid of containerIds) {
    const container = source.nodes[cid];
    if (container) topChildIds.push(...container.childIds.filter((id) => source.nodes[id]));
  }

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

  return topChildIds.map(convert).filter((x): x is SeedNode => x !== null);
}

/**
 * Build the import-project `SeedNode` from one or more workspaces. A single workspace grafts its
 * content directly under the import project; multiple workspaces each get their own sub-project
 * (named after the workspace) under it.
 */
export function buildImportSeed(workspaces: NamedWorkspace[], newId: () => string, now: Date): SeedNode {
  const root: SeedNode = { id: newId(), title: importProjectName(now), project: true, children: [] };
  if (workspaces.length === 1) {
    root.children = workspaceContent(workspaces[0].doc, newId);
  } else {
    root.children = workspaces.map((w) => ({
      id: newId(),
      title: w.name || 'Workspace',
      project: true,
      children: workspaceContent(w.doc, newId),
    }));
  }
  return root;
}

export type ImportResult = { ok: true; seed: SeedNode } | { ok: false; error: string };

/** Parse + build in one step for the UI; returns a clear error instead of throwing. */
export function importSeedFromJson(text: string, newId: () => string, now: Date): ImportResult {
  const workspaces = parseImport(text);
  if (!workspaces) return { ok: false, error: "That file isn't a valid NAM workspace export." };
  return { ok: true, seed: buildImportSeed(workspaces, newId, now) };
}
