import { describe, expect, it } from 'vitest';
import { displayCount, formatCount, newCountValue, parseCount } from './resourceCount';
import { applyIntent } from './mutations';
import { createDefaultWorkspace } from './createWorkspace';
import type { Resource } from './types';

describe('count resources (#798)', () => {
  it('parses and formats the packed value, clamping honestly', () => {
    expect(parseCount('3/10')).toEqual({ current: 3, target: 10, unlimited: false });
    expect(parseCount('12/10')).toEqual({ current: 10, target: 10, unlimited: false }); // clamped
    expect(parseCount('banana')).toBeNull();
    expect(parseCount('3/0')).toBeNull(); // a zero-target counter is no counter
    expect(newCountValue(5)).toBe('0/5');
    expect(formatCount(7, 5)).toBe('5/5');
  });

  it('unlimited counters (#800): the trailing "+" makes the target a goal, not a cap', () => {
    expect(parseCount('14/12+')).toEqual({ current: 14, target: 12, unlimited: true }); // overshoot kept
    expect(formatCount(14, 12, true)).toBe('14/12+');
    expect(displayCount({ current: 14, target: 12, unlimited: true })).toBe('14/12'); // marker is for machines
    expect(newCountValue(5, true)).toBe('0/5+');
    expect(parseCount('3/0+')).toBeNull(); // malformed stays malformed
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

    // The decrement (#798 stock-keeping): −1 sticks, and zero is its floor.
    next = applyIntent(doc, { type: 'incrementCountResource', id: 'a1', index: 1, expectedValue: '2/3', delta: -1, now: 'T' });
    expect(next.nodes['a1'].resources[1].value).toBe('1/3');
    const zeroed = { ...doc, nodes: { ...doc.nodes, a1: { ...doc.nodes['a1'], resources: [doc.nodes['a1'].resources[0], { type: 'COUNT' as const, value: '0/3', description: 'boxes' }] } } };
    next = applyIntent(zeroed, { type: 'incrementCountResource', id: 'a1', index: 1, expectedValue: '0/3', delta: -1, now: 'T' });
    expect(next.nodes['a1'].resources[1].value).toBe('0/3');
    // A FULL counter can still step down (stock: use from a full shelf).
    const fullDoc = { ...doc, nodes: { ...doc.nodes, a1: { ...doc.nodes['a1'], resources: [doc.nodes['a1'].resources[0], { type: 'COUNT' as const, value: '3/3', description: 'boxes' }] } } };
    next = applyIntent(fullDoc, { type: 'incrementCountResource', id: 'a1', index: 1, expectedValue: '3/3', delta: -1, now: 'T' });
    expect(next.nodes['a1'].resources[1].value).toBe('2/3');

    // Unknown node: tolerated no-op.
    expect(() => applyIntent(doc, { type: 'incrementCountResource', id: 'ghost', index: 0, expectedValue: 'x', now: 'T' })).not.toThrow();
  });

  it('incrementCountResource on an unlimited counter (#800): +1 keeps counting past the goal', () => {
    let doc = createDefaultWorkspace();
    const inbox = doc.nodes[doc.inboxNodeId];
    doc = {
      ...doc,
      nodes: {
        ...doc.nodes,
        a1: {
          ...inbox,
          id: 'a1',
          title: 'Stock up',
          project: false,
          childIds: [],
          resources: [{ type: 'COUNT', value: '12/12+', description: 'jars' }],
        },
      },
    };

    // At goal: +1 overshoots instead of no-opping.
    let next = applyIntent(doc, { type: 'incrementCountResource', id: 'a1', index: 0, expectedValue: '12/12+', now: 'T' });
    expect(next.nodes['a1'].resources[0].value).toBe('13/12+');

    // Past goal: keeps going, and −1 comes back down without losing the marker.
    next = applyIntent(next, { type: 'incrementCountResource', id: 'a1', index: 0, expectedValue: '13/12+', now: 'T2' });
    expect(next.nodes['a1'].resources[0].value).toBe('14/12+');
    next = applyIntent(next, { type: 'incrementCountResource', id: 'a1', index: 0, expectedValue: '14/12+', delta: -1, now: 'T3' });
    expect(next.nodes['a1'].resources[0].value).toBe('13/12+');
  });
});
