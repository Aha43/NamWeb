import { describe, expect, it } from 'vitest';
import { isInProgress } from './inProgress';
import { IN_PROGRESS_TAG } from '@/domain/systemTags';
import type { NamNode } from '@/domain/types';

function node(tags: string[]): NamNode {
  return {
    id: 'x', title: 'x', description: null, status: 'NEXT', project: false,
    childIds: [], tags, blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null,
  };
}

describe('isInProgress (#968)', () => {
  it('is true when the node carries the #in-progress tag, case/legacy tolerant', () => {
    expect(isInProgress(node([IN_PROGRESS_TAG]))).toBe(true);
    expect(isInProgress(node(['in progress']))).toBe(true); // legacy spelling → canonical
    expect(isInProgress(node(['home', IN_PROGRESS_TAG]))).toBe(true);
    expect(isInProgress(node(['home']))).toBe(false);
    expect(isInProgress(node([]))).toBe(false);
  });
});
