// The COUNT resource (#798): a discrete counter on an action — "pack 12 boxes", tick as you
// go. The value packs machine state as "current/target" ("3/10"); description stays the human
// label, uniform with every resource type. Unknown-type readers show the raw string — legible.

import type { Resource } from './types';

export interface CountState {
  current: number;
  target: number;
}

/** Parse a COUNT value ("3/10"). Null for anything malformed — render as plain text then. */
export function parseCount(value: string): CountState | null {
  const m = /^(\d+)\/(\d+)$/.exec(value.trim());
  if (!m) return null;
  const current = Number(m[1]);
  const target = Number(m[2]);
  if (!Number.isFinite(current) || !Number.isFinite(target) || target < 1) return null;
  return { current: Math.min(current, target), target };
}

export function formatCount(current: number, target: number): string {
  return `${Math.max(0, Math.min(current, target))}/${target}`;
}

/** A fresh counter toward `target`. */
export function newCountValue(target: number): string {
  return formatCount(0, target);
}

export function isCountResource(resource: Resource): boolean {
  return resource.type === 'COUNT';
}
