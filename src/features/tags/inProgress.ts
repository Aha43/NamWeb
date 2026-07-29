import { IN_PROGRESS_TAG, canonicalTag } from '@/domain/systemTags';
import type { NamNode } from '@/domain/types';

/** Does this node carry the built-in `#in-progress` system tag? (Own tags — it's set per-node by the
 *  InProgressToggle, not inherited.) Case/legacy-tolerant via canonicalTag (#654). Powers the amber
 *  row tint and the views' "in-progress only" filter (#968). */
export function isInProgress(node: NamNode): boolean {
  return node.tags.some((tag) => canonicalTag(tag) === IN_PROGRESS_TAG);
}
