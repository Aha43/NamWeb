import { describe, expect, it } from 'vitest';
import { applyIntent, captureDeletion } from './mutations';
import { createDefaultWorkspace } from './createWorkspace';
import { nextActions, projects } from './lenses';
import type { SeedNode } from './mutations';

function seeded() {
  let doc = createDefaultWorkspace();
  const a = 'a';
  const proj: SeedNode = {
    id: 'proj',
    title: 'Trip',
    project: true,
    children: [
      { id: 'c1', title: 'Book flights', status: 'NEXT' },
      { id: 'c2', title: 'Reserve hotel', status: 'NEXT' },
    ],
  };
  doc = applyIntent(doc, { type: 'seedProject', parentId: doc.projectsNodeId, nodes: [proj], now: 't' });
  doc = applyIntent(doc, {
    type: 'addAction',
    parentId: doc.nextActionsNodeId,
    id: a,
    title: 'Loose action',
    status: 'NEXT',
    now: 't',
  });
  return doc;
}

describe('captureDeletion + restoreNodes (undo)', () => {
  it('restores a leaf action to its original place', () => {
    const doc = seeded();
    const capture = captureDeletion(doc, 'a')!;
    const deleted = applyIntent(doc, { type: 'deleteLeaf', id: 'a' });
    expect(deleted.nodes['a']).toBeUndefined();

    const restored = applyIntent(deleted, { type: 'restoreNodes', capture });
    expect(restored.nodes['a']?.title).toBe('Loose action');
    expect(nextActions(restored).map((n) => n.id)).toContain('a');
  });

  it('restores a whole project subtree (recursive delete → undo)', () => {
    const doc = seeded();
    const capture = captureDeletion(doc, 'proj')!;
    const deleted = applyIntent(doc, { type: 'deleteRecursive', id: 'proj' });
    expect(deleted.nodes['proj']).toBeUndefined();
    expect(deleted.nodes['c1']).toBeUndefined();

    const restored = applyIntent(deleted, { type: 'restoreNodes', capture });
    expect(projects(restored).map((p) => p.id)).toContain('proj');
    expect([...restored.nodes['proj'].childIds].sort()).toEqual(['c1', 'c2']);
    expect(restored.nodes['c1']?.title).toBe('Book flights');
  });

  it('restores at the original index among siblings', () => {
    let doc = seeded();
    // Add two more loose actions: order becomes [a, b, c] (addAction unshifts by default → reverse)
    doc = applyIntent(doc, { type: 'addAction', parentId: doc.nextActionsNodeId, id: 'b', title: 'B', status: 'NEXT', now: 't', atTop: false });
    doc = applyIntent(doc, { type: 'addAction', parentId: doc.nextActionsNodeId, id: 'c', title: 'C', status: 'NEXT', now: 't', atTop: false });
    const order = doc.nodes[doc.nextActionsNodeId].childIds;
    const midId = order[1];
    const capture = captureDeletion(doc, midId)!;
    const deleted = applyIntent(doc, { type: 'deleteLeaf', id: midId });
    const restored = applyIntent(deleted, { type: 'restoreNodes', capture });
    expect(restored.nodes[restored.nextActionsNodeId].childIds).toEqual(order);
  });

  it('re-attaches external blockedBy links stripped by the recursive delete', () => {
    let doc = seeded();
    // c1 (inside proj) blocks the loose action a.
    doc = applyIntent(doc, { type: 'addPrerequisite', actionId: 'a', prereqId: 'c1', now: 't' });
    expect(doc.nodes['a'].blockedBy).toContain('c1');

    const capture = captureDeletion(doc, 'proj')!;
    const deleted = applyIntent(doc, { type: 'deleteRecursive', id: 'proj' });
    expect(deleted.nodes['a'].blockedBy).not.toContain('c1'); // stripped

    const restored = applyIntent(deleted, { type: 'restoreNodes', capture });
    expect(restored.nodes['a'].blockedBy).toContain('c1'); // re-attached
  });

  it('is a no-op if the node is already back (replay-safe)', () => {
    const doc = seeded();
    const capture = captureDeletion(doc, 'a')!;
    // Apply restore without deleting → no duplicate.
    const restored = applyIntent(doc, { type: 'restoreNodes', capture });
    expect(restored.nodes[restored.nextActionsNodeId].childIds.filter((x) => x === 'a')).toHaveLength(1);
  });
});
