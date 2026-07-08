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
  it('top-level project action → sibling projects + own sub-projects (down) + Free actions', () => {
    const doc = build();
    // a1 is in A (top-level): no parent project; sibling = B; down into A's sub-project A1; Free.
    expect(ids(doc, 'a1').sort()).toEqual([doc.nextActionsNodeId, 'A1', 'B'].sort());
  });

  it('omits an archived sub-project from the down targets', () => {
    let doc = build();
    doc = applyIntent(doc, { type: 'setStatus', id: 'A1', status: 'ARCHIVED', now: 't' });
    expect(ids(doc, 'a1')).not.toContain('A1');
  });

  it('nested project action → parent project + siblings + Free actions', () => {
    const doc = build();
    // s1 is in A1 (under A). Parent project = A; siblings of A1 under A = none (a1 is an action, not a project).
    expect(ids(doc, 's1').sort()).toEqual(['A', doc.nextActionsNodeId].sort());
  });

  it('free action → the top-level projects (no Free actions entry, already free) (#694)', () => {
    const doc = build();
    const targets = actionMoveTargets(doc, 'f1');
    expect(targets.map((t) => t.id)).not.toContain(doc.nextActionsNodeId); // already free
    // The natural places to file a loose action: the top-level projects.
    expect(targets.map((t) => t.id).sort()).toEqual(['A', 'B']);
    expect(targets.every((t) => t.kind === 'toplevel')).toBe(true);
  });

  it('free action → archived top-level projects are not offered (#694)', () => {
    let doc = build();
    doc = applyIntent(doc, { type: 'setStatus', id: 'B', status: 'ARCHIVED', now: 't' });
    expect(ids(doc, 'f1')).toEqual(['A']);
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
