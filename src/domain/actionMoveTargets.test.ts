import { describe, expect, it } from 'vitest';
import { applyIntent, type SeedNode } from './mutations';
import { createDefaultWorkspace } from './createWorkspace';
import { actionMoveTargets } from './lenses';

// Top-level projects A (with action a1 + sub-project A1) and B; plus a free action f1.
function build() {
  let doc = createDefaultWorkspace();
  const a: SeedNode = {
    id: 'A',
    title: 'Project A',
    project: true,
    children: [
      { id: 'a1', title: 'Action in A', status: 'NEXT' },
      { id: 'A1', title: 'Sub A1', project: true, children: [{ id: 's1', title: 'Action in A1', status: 'NEXT' }] },
    ],
  };
  const b: SeedNode = { id: 'B', title: 'Project B', project: true, children: [] };
  doc = applyIntent(doc, { type: 'seedProject', parentId: doc.projectsNodeId, nodes: [a, b], now: 't' });
  doc = applyIntent(doc, { type: 'addAction', parentId: doc.nextActionsNodeId, id: 'f1', title: 'Free one', status: 'NEXT', now: 't' });
  return doc;
}

const ids = (doc: ReturnType<typeof build>, actionId: string) =>
  actionMoveTargets(doc, actionId).map((t) => t.id);

describe('actionMoveTargets', () => {
  it('top-level project action → sibling projects + Free actions (no parent project)', () => {
    const doc = build();
    expect(ids(doc, 'a1').sort()).toEqual([doc.nextActionsNodeId, 'B'].sort());
  });

  it('nested project action → parent project + siblings + Free actions', () => {
    const doc = build();
    // s1 is in A1 (under A). Parent project = A; siblings of A1 under A = none (a1 is an action, not a project).
    expect(ids(doc, 's1').sort()).toEqual(['A', doc.nextActionsNodeId].sort());
  });

  it('free action → the top-level projects (no Free actions entry, already free)', () => {
    const doc = build();
    const targets = ids(doc, 'f1');
    expect(targets).not.toContain(doc.nextActionsNodeId); // already free
    // Free actions live under the actions root (not a project) → no parent/sibling projects offered.
    expect(targets).toEqual([]);
  });

  it('returns nothing for a project node', () => {
    expect(actionMoveTargets(build(), 'A')).toEqual([]);
  });

  it('a move via moveNode lands the action under the chosen target', () => {
    let doc = build();
    doc = applyIntent(doc, { type: 'moveNode', id: 'a1', newParentId: 'B', now: 't' });
    expect(doc.nodes['B'].childIds).toContain('a1');
    expect(doc.nodes['A'].childIds).not.toContain('a1');
  });
});
