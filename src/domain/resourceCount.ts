// The COUNT resource (#798): a discrete counter on an action — "pack 12 boxes", tick as you
// go. The value packs machine state as "current/target" ("3/10"); description stays the human
// label, uniform with every resource type. Unknown-type readers show the raw string — legible.

import type { Resource } from './types';

export interface CountState {
  current: number;
  target: number;
  /** The target is a GOAL, not a cap (#800): green at/past it, counting continues ("14/12").
   *  Packed as a trailing "+" on the machine value — self-describing, legible to old readers. */
  unlimited: boolean;
}

/** Parse a COUNT value ("3/10", unlimited "14/12+"). Null for anything malformed. */
export function parseCount(value: string): CountState | null {
  const m = /^(\d+)\/(\d+)(\+?)$/.exec(value.trim());
  if (!m) return null;
  const current = Number(m[1]);
  const target = Number(m[2]);
  const unlimited = m[3] === '+';
  if (!Number.isFinite(current) || !Number.isFinite(target) || target < 1) return null;
  return { current: unlimited ? current : Math.min(current, target), target, unlimited };
}

export function formatCount(current: number, target: number, unlimited = false): string {
  const clamped = Math.max(0, unlimited ? current : Math.min(current, target));
  return `${clamped}/${target}${unlimited ? '+' : ''}`;
}

/** The human display — the machine marker stays off the page ("14/12", not "14/12+"). */
export function displayCount(state: CountState): string {
  return `${state.current}/${state.target}`;
}

/** A fresh counter toward `target`. */
export function newCountValue(target: number, unlimited = false): string {
  return formatCount(0, target, unlimited);
}

export function isCountResource(resource: Resource): boolean {
  return resource.type === 'COUNT';
}
