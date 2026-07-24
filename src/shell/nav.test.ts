import { describe, expect, it } from 'vitest';
import { MORE_GROUPS, SIDEBAR_GROUPS } from './nav';

const has = (groups: { items: { to: string }[] }[], to: string): boolean =>
  groups.some((g) => g.items.some((it) => it.to === to));

describe('nav', () => {
  // #915: Loose ends shipped reachable on desktop (sidebar) but not phone (More) — guard both so a
  // new surface can't again land on one platform only.
  it('Loose ends is reachable on desktop (sidebar) AND phone (More)', () => {
    expect(has(SIDEBAR_GROUPS, '/loose-ends')).toBe(true);
    expect(has(MORE_GROUPS, '/loose-ends')).toBe(true);
  });
});
