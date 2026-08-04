import { describe, expect, it } from 'vitest';
import { contextViewKey } from './contextViewKey';

describe('contextViewKey (#1036)', () => {
  it('is stable regardless of the order tags were selected', () => {
    expect(contextViewKey(['work', 'home'])).toBe(contextViewKey(['home', 'work']));
  });

  it('namespaces under context: and joins sorted tags', () => {
    expect(contextViewKey(['home', 'work'])).toBe('context:home+work');
  });

  it('de-duplicates and canonicalizes system tags (legacy → sigil)', () => {
    // A legacy "in progress" and its canonical form collapse to one key entry.
    expect(contextViewKey(['in progress', '#in-progress'])).toBe('context:#in-progress');
  });

  it('a single tag gives a simple key', () => {
    expect(contextViewKey(['errand'])).toBe('context:errand');
  });
});
