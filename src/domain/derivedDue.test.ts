import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { effectiveDue } from './derivedDue';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'NEXT', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

// Minimal doc: whatever nodes the test wires; ids are looked up directly.
function doc(nodes: NamNode[]): WorkspaceDocument {
  const map: Record<string, NamNode> = {};
  for (const n of nodes) map[n.id] = n;
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: map, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

describe('effectiveDue (#706)', () => {
  it('is bit-for-bit explicit for non-projects and for projects with the toggle off', () => {
    const d = doc([
      node('a', { dueAt: '2026-07-10', dueTime: '09:00' }),
      node('p', { project: true, deriveDue: undefined, dueAt: '2026-07-10', childIds: ['a'] }),
    ]);
    expect(effectiveDue(d, 'a')).toMatchObject({ dueAt: '2026-07-10', dueTime: '09:00', derivedStart: false, derivedEnd: false });
    expect(effectiveDue(d, 'p')).toMatchObject({ dueAt: '2026-07-10', dueEndAt: null, derivedStart: false, derivedEnd: false });
  });

  it('derives both edges from the contents (range children widen the span)', () => {
    const d = doc([
      node('p', { project: true, deriveDue: true, childIds: ['a', 'b'] }),
      node('a', { dueAt: '2026-07-10' }),
      node('b', { dueAt: '2026-07-12', dueEndAt: '2026-07-14' }),
    ]);
    expect(effectiveDue(d, 'p')).toEqual({
      dueAt: '2026-07-10', dueEndAt: '2026-07-14', dueTime: null, dueEndTime: null,
      derivedStart: true, derivedEnd: true,
    });
  });

  it('the holiday case: explicit start wins (with its time), the end keeps deriving', () => {
    const d = doc([
      node('p', { project: true, deriveDue: true, dueAt: '2026-07-08', dueTime: '06:30', childIds: ['flight', 'hotel'] }),
      node('flight', { dueAt: '2026-07-10', status: 'DONE' }), // booked & done — still marks the trip
      node('hotel', { dueAt: '2026-07-11', dueEndAt: '2026-07-14' }),
    ]);
    expect(effectiveDue(d, 'p')).toEqual({
      dueAt: '2026-07-08', dueEndAt: '2026-07-14', dueTime: '06:30', dueEndTime: null,
      derivedStart: false, derivedEnd: true,
    });
  });

  it('fully explicit dates make derivation moot even when on', () => {
    const d = doc([
      node('p', { project: true, deriveDue: true, dueAt: '2026-07-08', dueEndAt: '2026-07-20', dueEndTime: '17:00', childIds: ['a'] }),
      node('a', { dueAt: '2026-06-01', dueEndAt: '2026-08-01' }),
    ]);
    expect(effectiveDue(d, 'p')).toMatchObject({
      dueAt: '2026-07-08', dueEndAt: '2026-07-20', dueEndTime: '17:00', derivedStart: false, derivedEnd: false,
    });
  });

  it('excludes CANCELLED items and ARCHIVED subtrees; includes DONE', () => {
    const d = doc([
      node('p', { project: true, deriveDue: true, childIds: ['done', 'cancelled', 'old'] }),
      node('done', { dueAt: '2026-07-10', status: 'DONE' }),
      node('cancelled', { dueAt: '2026-01-01', status: 'CANCELLED' }),
      node('old', { project: true, status: 'ARCHIVED', childIds: ['oldAct'] }),
      node('oldAct', { dueAt: '2026-12-31' }),
    ]);
    expect(effectiveDue(d, 'p')).toMatchObject({ dueAt: '2026-07-10', dueEndAt: null, derivedStart: true, derivedEnd: false });
  });

  it('natural recursion: a deriving sub-project feeds its effective span; a toggle-off one only its explicit dates', () => {
    const d = doc([
      node('trip', { project: true, deriveDue: true, childIds: ['leg', 'fenced'] }),
      node('leg', { project: true, deriveDue: true, childIds: ['stop'] }), // no explicit dates of its own
      node('stop', { dueAt: '2026-07-20', dueEndAt: '2026-07-22' }),
      node('fenced', { project: true, childIds: ['fencedAct'] }), // toggle off, undated → contributes nothing
      node('fencedAct', { dueAt: '2026-09-01' }),
    ]);
    expect(effectiveDue(d, 'trip')).toMatchObject({ dueAt: '2026-07-20', dueEndAt: '2026-07-22', derivedStart: true, derivedEnd: true });
  });

  it('a derived end never inverts an explicit start — clamped to a single date', () => {
    const d = doc([
      node('p', { project: true, deriveDue: true, dueAt: '2026-07-20', childIds: ['early'] }),
      node('early', { dueAt: '2026-07-10' }),
    ]);
    expect(effectiveDue(d, 'p')).toMatchObject({ dueAt: '2026-07-20', dueEndAt: null, derivedStart: false, derivedEnd: false });
  });

  it('a single dated day derives a single date, not a range; no dated content leaves the project undated', () => {
    const d = doc([
      node('p', { project: true, deriveDue: true, childIds: ['a'] }),
      node('a', { dueAt: '2026-07-10' }),
      node('q', { project: true, deriveDue: true, childIds: [] }),
    ]);
    expect(effectiveDue(d, 'p')).toMatchObject({ dueAt: '2026-07-10', dueEndAt: null, derivedStart: true, derivedEnd: false });
    expect(effectiveDue(d, 'q')).toMatchObject({ dueAt: null, dueEndAt: null, derivedStart: false, derivedEnd: false });
  });
});
