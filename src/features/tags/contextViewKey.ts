import { canonicalTag } from '@/domain/systemTags';

/**
 * The `viewOrders` key for a context (tag-filtered) view's manual order (#1036). Canonicalized,
 * de-duplicated, and **sorted**, so the key is stable regardless of the order you clicked the chips —
 * and an ad-hoc selection shares one order with a saved view / bookmark of the same tags. The order
 * is deliberately independent of "Next only" / status boxes (those just hide rows; the persisted
 * order spans the whole context). Namespaced under `context:` so it can't collide with the fixed
 * view keys (`next`, `backlog`, …) in the same `viewOrders` map.
 */
export function contextViewKey(tags: string[]): string {
  const canon = [...new Set(tags.map((t) => canonicalTag(t)))].sort();
  return `context:${canon.join('+')}`;
}
