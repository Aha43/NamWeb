import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import type { SeedNode } from './mutations';
import { buildImportSeed, importProjectName, importSeedFromJson, parseImport } from './importWorkspace';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

// projects/[P1 → A1], free action F1 (blocked by A1), inbox item I1.
function doc(): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {};
  for (const n of [
    node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    node('inbox', { childIds: ['I1'] }),
    node('projects', { childIds: ['P1'] }),
    node('actions', { childIds: ['F1'] }),
    node('P1', { project: true, title: 'Roof', childIds: ['A1'] }),
    node('A1', { title: 'Buy tiles', status: 'NEXT', tags: ['home'] }),
    node('F1', { title: 'Free one', blockedBy: ['A1'], resources: [
      { type: 'URI', value: 'nam://action/A1', description: null },
      { type: 'URI', value: 'nam://action/GONE', description: null },
      { type: 'URI', value: 'https://kept.example', description: null },
    ] }),
    node('I1', { title: 'Captured thought' }),
  ]) nodes[n.id] = n;
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

/** The account "Export my data" bundle shape. */
function bundle(workspaces: { name: string; document: WorkspaceDocument }[]) {
  return JSON.stringify({ exportedAt: '2026-06-20T00:00:00Z', user: { id: 'u', email: null }, workspaces });
}

function allIds(seed: SeedNode): Set<string> {
  const out = new Set<string>();
  const walk = (s: SeedNode) => { out.add(s.id); s.children?.forEach(walk); };
  walk(seed);
  return out;
}

function findByTitle(seed: SeedNode, title: string): SeedNode | null {
  if (seed.title === title) return seed;
  for (const c of seed.children ?? []) {
    const hit = findByTitle(c, title);
    if (hit) return hit;
  }
  return null;
}

describe('parseImport', () => {
  it('accepts the export bundle and a bare document; rejects junk', () => {
    expect(parseImport(bundle([{ name: 'Main', document: doc() }]))).toHaveLength(1);
    expect(parseImport(JSON.stringify(doc()))).toHaveLength(1); // bare document
    expect(parseImport('not json')).toBeNull();
    expect(parseImport(JSON.stringify({ hello: 'world' }))).toBeNull();
    expect(parseImport(JSON.stringify({ workspaces: [{ name: 'x', document: { nope: true } }] }))).toBeNull();
  });
});

describe('importProjectName', () => {
  it('is a collision-safe timestamp', () => {
    expect(importProjectName(new Date('2026-06-20T09:08:07'))).toBe('import-2026-06-20-09-08-07');
  });
});

describe('buildImportSeed', () => {
  it('single workspace: grafts content directly, fresh ids, remapped blockers', () => {
    let n = 0;
    const seed = buildImportSeed([{ name: 'Main', doc: doc() }], () => `n${n++}`, new Date('2026-06-20T00:00:00'));
    expect(seed.project).toBe(true);
    expect(seed.title).toMatch(/^import-/);
    expect(seed.children?.map((c) => c.title)).toEqual(['Roof', 'Free one', 'Captured thought']);

    const ids = allIds(seed);
    for (const old of ['P1', 'A1', 'F1', 'I1']) expect(ids.has(old)).toBe(false);

    const roof = seed.children![0];
    expect(roof.children?.[0]).toMatchObject({ title: 'Buy tiles', status: 'NEXT', tags: ['home'] });
    const free = seed.children![1];
    expect(free.blockedBy).toEqual([roof.children![0].id]); // remapped to the new A1 id
    // Action-link resources follow the id map too (#658); a link to something outside the
    // import dangles (rendered as gone); ordinary resources pass through untouched.
    expect(free.resources?.map((r) => r.value)).toEqual([
      `nam://action/${roof.children![0].id}`,
      'nam://action/GONE',
      'https://kept.example',
    ]);
  });

  it('preserves all due scheduling metadata through import (#509)', () => {
    const d = doc();
    d.nodes['A1'] = {
      ...d.nodes['A1'],
      dueAt: '2026-08-12',
      dueEndAt: '2026-08-16',
      dueTime: '09:00',
      dueEndTime: '17:30',
    };
    let n = 0;
    const seed = buildImportSeed([{ name: 'Main', doc: d }], () => `n${n++}`, new Date('2026-06-20T00:00:00'));
    const tiles = findByTitle(seed, 'Buy tiles');
    expect(tiles).toMatchObject({
      dueAt: '2026-08-12',
      dueEndAt: '2026-08-16',
      dueTime: '09:00',
      dueEndTime: '17:30',
    });
  });

  it('multiple workspaces: each becomes its own sub-project under the import root', () => {
    let n = 0;
    const seed = buildImportSeed(
      [{ name: 'Home', doc: doc() }, { name: 'Work', doc: doc() }],
      () => `n${n++}`,
      new Date(),
    );
    expect(seed.children?.map((c) => c.title)).toEqual(['Home', 'Work']);
    expect(seed.children?.every((c) => c.project)).toBe(true);
  });
});

describe('importSeedFromJson', () => {
  it('errors on junk, succeeds on a real bundle', () => {
    expect(importSeedFromJson('garbage', () => 'x', new Date())).toMatchObject({ ok: false });
    let n = 0;
    expect(importSeedFromJson(bundle([{ name: 'Main', document: doc() }]), () => `m${n++}`, new Date()).ok).toBe(true);
  });
});
