import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { childColumn, rootColumn, specialRoots, type PickerTarget } from './pickerModel';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id,
    title: id,
    description: null,
    status: 'BACKLOG',
    project: false,
    childIds: [],
    tags: [],
    blockedBy: [],
    resources: [],
    createdAt: null,
    updatedAt: null,
    statusChangedAt: null,
    dueAt: null,
    ...partial,
  };
}

// Structural skeleton + a small tree:
//   Home Reno > Bathroom > Plumbing ; Work (leaf) ; Old (archived) ; free action "tiles".
function doc(): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {};
  for (const n of [
    node('root', { title: 'NAM', childIds: ['inbox', 'projects', 'actions'] }),
    node('inbox', { title: 'Inbox' }),
    node('projects', { title: 'Projects', childIds: ['home', 'work', 'old'] }),
    node('actions', { title: 'Actions', childIds: ['tiles'] }),
    node('home', { title: 'Home Reno', project: true, childIds: ['bath'] }),
    node('bath', { title: 'Bathroom', project: true, childIds: ['plumb'] }),
    node('plumb', { title: 'Plumbing', project: true }),
    node('work', { title: 'Work', project: true }),
    node('old', { title: 'Old', project: true, status: 'ARCHIVED' }),
    node('tiles', { title: 'Buy tiles', status: 'NEXT' }),
  ]) {
    nodes[n.id] = n;
  }
  return {
    formatVersion: 1,
    rootNodeId: 'root',
    inboxNodeId: 'inbox',
    projectsNodeId: 'projects',
    nextActionsNodeId: 'actions',
    nodes,
    registeredTags: [],
    savedViews: [],
    missionControls: [],
    templates: [],
    viewOrders: {},
  };
}

// Targets as the Action editor builds them when moving the free action "tiles": "Free actions"
// (a container) + every non-archived project.
function allProjectTargets(): PickerTarget[] {
  return [
    { id: 'actions', label: 'Free actions' },
    { id: 'home', label: 'Home Reno' },
    { id: 'bath', label: 'Home Reno › Bathroom' },
    { id: 'plumb', label: 'Home Reno › Bathroom › Plumbing' },
    { id: 'work', label: 'Work' },
  ];
}

describe('specialRoots', () => {
  it('keeps only targets whose id is not a real project node', () => {
    expect(specialRoots(doc(), allProjectTargets())).toEqual([
      { id: 'actions', label: 'Free actions', hasChildren: false, selectable: true, isSpecial: true },
    ]);
  });
});

describe('rootColumn', () => {
  it('lists special roots, then top-level projects, excluding archived', () => {
    const d = doc();
    const allowed = new Set(allProjectTargets().map((t) => t.id));
    const col = rootColumn(d, allProjectTargets(), allowed);
    expect(col.map((i) => i.label)).toEqual(['Free actions', 'Home Reno', 'Work']);
    expect(col.find((i) => i.id === 'old')).toBeUndefined(); // archived excluded
  });

  it('marks projects with sub-projects as hasChildren', () => {
    const d = doc();
    const allowed = new Set(allProjectTargets().map((t) => t.id));
    const col = rootColumn(d, allProjectTargets(), allowed);
    expect(col.find((i) => i.id === 'home')?.hasChildren).toBe(true);
    expect(col.find((i) => i.id === 'work')?.hasChildren).toBe(false);
  });

  it('greys out projects not in the allowed set (still listed + navigable)', () => {
    const d = doc();
    // Simulate moving 'home': its whole subtree is excluded, so home/bath/plumb are not targets.
    const targets: PickerTarget[] = [
      { id: 'actions', label: 'Free actions' },
      { id: 'work', label: 'Work' },
    ];
    const allowed = new Set(targets.map((t) => t.id));
    const col = rootColumn(d, targets, allowed);
    expect(col.find((i) => i.id === 'home')?.selectable).toBe(false); // greyed but present
    expect(col.find((i) => i.id === 'home')?.hasChildren).toBe(true); // still navigable
    expect(col.find((i) => i.id === 'work')?.selectable).toBe(true);
  });
});

describe('childColumn', () => {
  it('returns a project’s sub-projects with correct selectable/hasChildren', () => {
    const d = doc();
    const allowed = new Set(allProjectTargets().map((t) => t.id));
    const col = childColumn(d, 'home', allowed);
    expect(col.map((i) => i.label)).toEqual(['Bathroom']);
    expect(col[0]).toMatchObject({ id: 'bath', hasChildren: true, selectable: true, isSpecial: false });

    const deeper = childColumn(d, 'bath', allowed);
    expect(deeper.map((i) => i.id)).toEqual(['plumb']);
    expect(deeper[0].hasChildren).toBe(false);
  });

  it('returns an empty column for a leaf project', () => {
    const d = doc();
    const allowed = new Set(allProjectTargets().map((t) => t.id));
    expect(childColumn(d, 'work', allowed)).toEqual([]);
  });
});
