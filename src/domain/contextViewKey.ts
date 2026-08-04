import { canonicalTag } from './systemTags';

const PREFIX = 'context:';

/**
 * The `viewOrders` key for a context (tag-filtered) view's manual order (#1036). Each canonical tag
 * is **URL-encoded** before joining, so the encoding is injective — a literal `+` (or any delimiter)
 * inside a tag can't collide two distinct contexts: `['a+b']` → `context:a%2Bb` vs `['a','b']` →
 * `context:a+b` (#1036 review, P2). De-duplicated and **sorted**, so the key is independent of the
 * order chips were clicked, and shared with a saved view / bookmark of the same tags. Namespaced
 * under `context:` so it can't collide with the fixed view keys (`next`, `backlog`, …).
 */
export function contextViewKey(tags: string[]): string {
  const canon = [...new Set(tags.map((t) => canonicalTag(t)))].sort();
  return PREFIX + canon.map(encodeURIComponent).join('+');
}

/** The canonical tags a context key encodes, or `null` if `key` isn't a context key. Inverse of
 *  {@link contextViewKey}: `encodeURIComponent` never emits a bare `+`, so splitting on `+` and
 *  decoding each part recovers the exact tags. */
export function decodeContextKey(key: string): string[] | null {
  if (!key.startsWith(PREFIX)) return null;
  const body = key.slice(PREFIX.length);
  return body === '' ? [] : body.split('+').map(decodeURIComponent);
}

/**
 * Re-key context orders when a tag is renamed (#1036 review, P2): a live context keeps its
 * hand-sorted order under the new tag, and every multi-tag context containing `from` migrates too.
 * Non-context keys (`next`, …) and contexts without `from` pass through untouched. Collisions — the
 * destination context already has an order — merge **deterministically**: the destination's existing
 * order leads, then the incoming ids it doesn't already contain (so no drag is silently lost).
 */
export function renameTagInContextOrders(
  viewOrders: Record<string, string[]>,
  from: string,
  to: string,
): Record<string, string[]> {
  const fromC = canonicalTag(from);
  const toC = canonicalTag(to);
  const out: Record<string, string[]> = {};
  const affected: Array<{ tags: string[]; order: string[] }> = [];
  // Pass 1: carry through everything that doesn't reference the renamed tag — including a
  // pre-existing destination context, so on a merge its order leads.
  for (const [key, order] of Object.entries(viewOrders)) {
    const tags = decodeContextKey(key);
    if (tags && tags.includes(fromC)) affected.push({ tags, order });
    else out[key] = order;
  }
  // Pass 2: re-key the affected contexts, merging into any existing destination.
  for (const { tags, order } of affected) {
    const key = contextViewKey(tags.map((t) => (t === fromC ? toC : t)));
    out[key] = key in out ? [...out[key], ...order.filter((id) => !out[key].includes(id))] : order;
  }
  return out;
}

/** Drop context orders that reference a deleted tag (#1036 review): the context can never be
 *  re-selected once the tag is gone, so its stored order is dead weight. Symmetric with rename. */
export function deleteTagInContextOrders(
  viewOrders: Record<string, string[]>,
  tag: string,
): Record<string, string[]> {
  const tagC = canonicalTag(tag);
  const out: Record<string, string[]> = {};
  for (const [key, order] of Object.entries(viewOrders)) {
    const tags = decodeContextKey(key);
    if (!(tags && tags.includes(tagC))) out[key] = order;
  }
  return out;
}
