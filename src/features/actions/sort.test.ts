import { describe, expect, it } from 'vitest';
import type { NamNode } from '@/domain/types';
import { sortByDue, sortNodes } from './sort';

function node(id: string, createdAt: string | null): NamNode {
  return {
    id, title: id, description: null, status: 'NEXT', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt, updatedAt: null, statusChangedAt: null, dueAt: null,
  };
}

const a = node('a', '2026-06-01T10:00:00');
const b = node('b', '2026-06-03T10:00:00');
const c = node('c', '2026-06-02T10:00:00');

describe('sortNodes', () => {
  it('keeps document order when unsorted', () => {
    expect(sortNodes([a, b, c], 'none').map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('fifo sorts oldest-first by createdAt', () => {
    expect(sortNodes([a, b, c], 'fifo').map((n) => n.id)).toEqual(['a', 'c', 'b']);
  });

  it('lifo sorts newest-first', () => {
    expect(sortNodes([a, b, c], 'lifo').map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const input = [a, b, c];
    sortNodes(input, 'fifo');
    expect(input.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('sortByDue', () => {
  const due = (id: string, dueAt: string | null) => ({ id, dueAt });

  it('sorts soonest-first by due date', () => {
    const items = [due('a', '2026-07-10'), due('b', '2026-07-01'), due('c', '2026-07-05')];
    expect(sortByDue(items).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('puts undated items last, preserving their incoming order', () => {
    const items = [due('a', null), due('b', '2026-07-01'), due('c', null), due('d', '2026-06-30')];
    expect(sortByDue(items).map((i) => i.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('is stable for items sharing a due date', () => {
    const items = [due('a', '2026-07-01'), due('b', '2026-07-01'), due('c', '2026-06-30')];
    expect(sortByDue(items).map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('does not mutate the input array', () => {
    const items = [due('a', '2026-07-10'), due('b', '2026-07-01')];
    sortByDue(items);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('breaks a shared date by time of day, untimed first (#493)', () => {
    const dt = (id: string, dueAt: string, dueTime: string | null) => ({ id, dueAt, dueTime });
    const items = [
      dt('a', '2026-07-01', '14:30'),
      dt('b', '2026-07-01', null), // all-day → before timed
      dt('c', '2026-07-01', '09:00'),
      dt('d', '2026-06-30', '23:00'), // earlier date wins regardless of time
    ];
    expect(sortByDue(items).map((i) => i.id)).toEqual(['d', 'b', 'c', 'a']);
  });
});
