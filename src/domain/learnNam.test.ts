import { describe, expect, it } from 'vitest';
import { buildLearnNam } from './learnNam';
import type { SeedNode } from './mutations';

function flatten(node: SeedNode): SeedNode[] {
  return [node, ...(node.children ?? []).flatMap(flatten)];
}

describe('buildLearnNam', () => {
  it('builds a Learn NAM project with three belts and learn-by-doing actions', () => {
    let n = 0;
    const seed = buildLearnNam(() => `id${n++}`, new Date('2026-06-19T09:00:00'));

    expect(seed.project).toBe(true);
    expect(seed.title).toContain('Learn NAM');
    // Three belt sub-projects.
    const belts = (seed.children ?? []).filter((c) => c.project);
    expect(belts).toHaveLength(3);

    const all = flatten(seed);
    const actions = all.filter((node) => !node.project);
    // Every action carries a description (the lesson).
    expect(actions.every((a) => Boolean(a.description))).toBe(true);
    // Showcases every view: a DONE, a due date, a blocker, a resource, a tag.
    expect(all.some((a) => a.status === 'DONE')).toBe(true);
    expect(all.some((a) => a.dueAt)).toBe(true);
    expect(all.some((a) => a.resources && a.resources.length > 0)).toBe(true);
    expect(all.some((a) => a.tags?.includes('learn'))).toBe(true);

    // The blocker references an id that actually exists within the seed.
    const ids = new Set(all.map((a) => a.id));
    const blocked = all.find((a) => a.blockedBy && a.blockedBy.length > 0)!;
    expect(blocked.blockedBy!.every((b) => ids.has(b))).toBe(true);
  });

  it('generates a fresh, unique id per node', () => {
    let n = 0;
    const seed = buildLearnNam(() => `id${n++}`, new Date());
    const ids = flatten(seed).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
