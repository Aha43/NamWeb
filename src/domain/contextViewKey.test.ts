import { describe, expect, it } from 'vitest';
import {
  contextViewKey,
  decodeContextKey,
  deleteTagInContextOrders,
  renameTagInContextOrders,
} from './contextViewKey';

describe('contextViewKey (#1036)', () => {
  it('is stable regardless of the order tags were selected', () => {
    expect(contextViewKey(['work', 'home'])).toBe(contextViewKey(['home', 'work']));
  });

  it('namespaces under context: and joins sorted tags', () => {
    expect(contextViewKey(['home', 'work'])).toBe('context:home+work');
  });

  it('de-duplicates and canonicalizes system tags (legacy → sigil)', () => {
    expect(contextViewKey(['in progress', '#in-progress'])).toBe('context:%23in-progress');
  });

  it('is injective — a tag containing the delimiter cannot collide two contexts (#1036 review, P2)', () => {
    // The bug: a raw `+` join made ['a+b'] and ['a','b'] share a key. Encoding separates them.
    expect(contextViewKey(['a+b'])).not.toBe(contextViewKey(['a', 'b']));
    expect(contextViewKey(['a+b'])).toBe('context:a%2Bb');
    expect(contextViewKey(['a', 'b'])).toBe('context:a+b');
  });

  it('round-trips through decodeContextKey', () => {
    expect(decodeContextKey(contextViewKey(['a+b', 'c']))).toEqual(['a+b', 'c']);
    expect(decodeContextKey('next')).toBeNull(); // a fixed view key, not a context
  });
});

describe('renameTagInContextOrders (#1036 review, P2)', () => {
  it('carries a single-tag context order to the new tag', () => {
    const vo = { 'context:work': ['a', 'b'], next: ['x'] };
    expect(renameTagInContextOrders(vo, 'work', 'job')).toEqual({ next: ['x'], 'context:job': ['a', 'b'] });
  });

  it('migrates multi-tag contexts containing the renamed tag (re-sorted key)', () => {
    const vo = { 'context:home+work': ['a', 'b'] };
    // work→job: [home, job] re-sorts to home+job.
    expect(renameTagInContextOrders(vo, 'work', 'job')).toEqual({ 'context:home+job': ['a', 'b'] });
  });

  it('merges deterministically when the destination context already has an order (existing leads)', () => {
    const vo = { 'context:job': ['x', 'y'], 'context:work': ['y', 'z'] };
    // work→job collides with the existing job order; existing leads, new-unique appended.
    expect(renameTagInContextOrders(vo, 'work', 'job')).toEqual({ 'context:job': ['x', 'y', 'z'] });
  });

  it('leaves unrelated contexts untouched', () => {
    const vo = { 'context:errand': ['a'] };
    expect(renameTagInContextOrders(vo, 'work', 'job')).toEqual({ 'context:errand': ['a'] });
  });
});

describe('deleteTagInContextOrders (#1036 review)', () => {
  it('drops any context order referencing the deleted tag, keeps the rest', () => {
    const vo = { 'context:work': ['a'], 'context:home+work': ['b'], 'context:home': ['c'], next: ['x'] };
    expect(deleteTagInContextOrders(vo, 'work')).toEqual({ 'context:home': ['c'], next: ['x'] });
  });
});
