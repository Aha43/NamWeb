import { describe, expect, it } from 'vitest';
import { formatCount, newCountValue, parseCount } from './resourceCount';
import { applyIntent } from './mutations';
import { createDefaultWorkspace } from './createWorkspace';
import type { Resource } from './types';

describe('count resources (#798)', () => {
  it('parses and formats the packed value, clamping honestly', () => {
    expect(parseCount('3/10')).toEqual({ current: 3, target: 10 });
    expect(parseCount('12/10')).toEqual({ current: 10, target: 10 }); // clamped
    expect(parseCount('banana')).toBeNull();
    expect(parseCount('3/0')).toBeNull(); // a zero-target counter is no counter
    expect(newCountValue(5)).toBe('0/5');
    expect(formatCount(7, 5)).toBe('5/5');
  });

  it('incrementCountResource: +1 sticks; stale, full, shifted, and wrong-type all no-op', () => {
    let doc = createDefaultWorkspace();
    const inbox = doc.nodes[doc.inboxNodeId];
    const counter: Resource = { type: 'COUNT', value: '2/3', description: 'boxes' };
    const note: Resource = { type: 'TEXT', value: 'hi', description: null };
    doc = {
      ...doc,
      nodes: {
        ...doc.nodes,
        a1: { ...inbox, id: 'a1', title: 'Pack', project: false, childIds: [], resources: [note, counter] },
      },
    };

    // The honest +1 (index 1, matching expectedValue).
    let next = applyIntent(doc, { type: 'incrementCountResource', id: 'a1', index: 1, expectedValue: '2/3', now: 'T' });
    expect(next.nodes['a1'].resources[1].value).toBe('3/3');
    expect(next.nodes['a1'].resources[1].description).toBe('boxes'); // label untouched
    expect(next.nodes['a1'].updatedAt).toBe('T');

    // Full counter: no overshoot.
    next = applyIntent(next, { type: 'incrementCountResource', id: 'a1', index: 1, expectedValue: '3/3', now: 'T2' });
    expect(next.nodes['a1'].resources[1].value).toBe('3/3');

    // Stale guard: the replay/raced tap no-ops instead of double-counting.
    next = applyIntent(doc, { type: 'incrementCountResource', id: 'a1', index: 1, expectedValue: '1/3', now: 'T' });
    expect(next.nodes['a1'].resources[1].value).toBe('2/3');

    // Shifted list / wrong type: index 0 is the TEXT note — untouched.
    next = applyIntent(doc, { type: 'incrementCountResource', id: 'a1', index: 0, expectedValue: '2/3', now: 'T' });
    expect(next.nodes['a1'].resources[0].value).toBe('hi');

    // Unknown node: tolerated no-op.
    expect(() => applyIntent(doc, { type: 'incrementCountResource', id: 'ghost', index: 0, expectedValue: 'x', now: 'T' })).not.toThrow();
  });
});
