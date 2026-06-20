import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { buildImportSeed, importProjectName, importSeedFromJson, parseWorkspaceJson } from './importWorkspace';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

// projects/[P1 → A1], free action F1 (blocked by A1), inbox item I1.
function source(): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {};
  for (const n of [
    node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    node('inbox', { childIds: ['I1'] }),
    node('projects', { childIds: ['P1'] }),
    node('actions', { childIds: ['F1'] }),
    node('P1', { project: true, title: 'Roof', childIds: ['A1'] }),
    node('A1', { title: 'Buy tiles', status: 'NEXT', tags: ['home'] }),
    node('F1', { title: 'Free one', blockedBy: ['A1'] }),
    node('I1', { title: 'Captured thought' }),
  ]) nodes[n.id] = n;
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

describe('parseWorkspaceJson', () => {
  it('accepts a valid workspace and rejects junk', () => {
    expect(parseWorkspaceJson(JSON.stringify(source()))).not.toBeNull();
    expect(parseWorkspaceJson('not json')).toBeNull();
    expect(parseWorkspaceJson(JSON.stringify({ hello: 'world' }))).toBeNull();
    expect(parseWorkspaceJson(JSON.stringify({ nodes: {}, projectsNodeId: 'x' }))).toBeNull();
  });
});

describe('importProjectName', () => {
  it('is a collision-safe timestamp', () => {
    expect(importProjectName(new Date('2026-06-20T09:08:07'))).toBe('import-2026-06-20-09-08-07');
  });
});

describe('buildImportSeed', () => {
  it('grafts projects as sub-projects + free/inbox actions, fresh ids, remapped blockers', () => {
    let n = 0;
    const seed = buildImportSeed(source(), () => `n${n++}`, new Date('2026-06-20T00:00:00'));

    expect(seed.project).toBe(true);
    expect(seed.title).toMatch(/^import-/);
    // Order: project first, then free action, then inbox item.
    expect(seed.children?.map((c) => c.title)).toEqual(['Roof', 'Free one', 'Captured thought']);

    // Fresh ids (none of the source ids survive).
    const allIds = new Set<string>();
    const walk = (s: typeof seed) => { allIds.add(s.id); s.children?.forEach(walk); };
    walk(seed);
    for (const old of ['P1', 'A1', 'F1', 'I1']) expect(allIds.has(old)).toBe(false);

    // Roof keeps its action + tags preserved.
    const roof = seed.children![0];
    expect(roof.children?.[0]).toMatchObject({ title: 'Buy tiles', status: 'NEXT', tags: ['home'] });

    // F1's blockedBy was remapped to the NEW id of A1 (not the old 'A1').
    const free = seed.children![1];
    const newA1Id = roof.children![0].id;
    expect(free.blockedBy).toEqual([newA1Id]);
  });
});

describe('importSeedFromJson', () => {
  it('returns an error for invalid input and a seed for valid', () => {
    expect(importSeedFromJson('garbage', () => 'x', new Date())).toEqual({
      ok: false,
      error: expect.stringContaining('valid NAM workspace'),
    });
    const ok = importSeedFromJson(JSON.stringify(source()), (() => { let i = 0; return () => `m${i++}`; })(), new Date());
    expect(ok.ok).toBe(true);
  });
});
