import { describe, expect, it } from 'vitest';
import type { NamNode } from '@/domain/types';
import { sortNodes } from './sort';

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
