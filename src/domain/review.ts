// The Review read model (#906) — the "Loose ends" overview's deterministic "mess" lenses. Pure over
// the workspace document, like calendar.ts. Always-on status, never a cadence: these just answer
// "what has quietly gone sideways?" whenever you look, with no scoring and no guilt. Typed as clean
// signals so a future AI layer can read exactly what a human sees.

import type { NamNode, WorkspaceDocument } from './types';
import { archivedNodeIds, structuralNodeIds, subtreeIds } from './lenses';
import { NOT_STALLED_TAG, canonicalTag } from './systemTags';

/** A project the user has explicitly marked "intentionally no next action" (#909). */
export function isNotStalled(n: NamNode): boolean {
  return n.tags.some((t) => canonicalTag(t) === NOT_STALLED_TAG);
}

/** Not DONE / CANCELLED — the item is still live. */
function isOpen(n: NamNode): boolean {
  return n.status !== 'DONE' && n.status !== 'CANCELLED';
}

/** Days without a touch before an open action counts as "gone quiet" (the default; adjustable later). */
export const GONE_QUIET_DAYS = 14;

/** The latest activity timestamp on a node (last updated / status-changed / created), or null. */
function lastTouched(n: NamNode): string | null {
  const stamps = [n.updatedAt, n.statusChangedAt, n.createdAt].filter((s): s is string => Boolean(s));
  // ISO-8601 strings sort chronologically, so the max is the most recent activity.
  return stamps.length ? stamps.sort()[stamps.length - 1] : null;
}

/**
 * Open, non-archived projects whose subtree contains **no open `NEXT` action** — nothing you could
 * actually pick up next. The canonical GTD "every project needs a next action" in plain terms. The
 * subtree is checked whole, so a container project whose sub-projects each have a next action is NOT
 * stalled; an empty project, or one with only backlog/done children, IS. Title-sorted.
 *
 * `#not-stalled`-tagged projects are excluded by default (#909) — the user has said they're
 * intentionally next-less. Pass `includeAcknowledged` to surface them too (to review/un-mark the set).
 */
export function stalledProjects(doc: WorkspaceDocument, includeAcknowledged = false): NamNode[] {
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  const hasOpenNext = (projectId: string): boolean => {
    for (const id of subtreeIds(doc, projectId)) {
      const n = doc.nodes[id];
      if (n && !n.project && n.status === 'NEXT') return true;
    }
    return false;
  };
  return Object.values(doc.nodes)
    .filter((n) => n.project && !structural.has(n.id) && !archived.has(n.id) && isOpen(n))
    .filter((p) => !hasOpenNext(p.id))
    .filter((p) => includeAcknowledged || !isNotStalled(p))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Open actions untouched for `GONE_QUIET_DAYS`+ (by their latest activity timestamp) — things that
 * have quietly gone still. Actions only (a project's quietness is better read from its contents — a
 * fast-follow), and raw inbox captures are excluded (they're covered by the Inbox count, not a loose
 * end yet). Framed as "quiet", never "neglected" — no guilt. Title-sorted.
 */
export function goneQuiet(doc: WorkspaceDocument, now: Date = new Date()): NamNode[] {
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  const inboxIds = new Set(doc.nodes[doc.inboxNodeId]?.childIds ?? []);
  const cutoff = now.getTime() - GONE_QUIET_DAYS * 86_400_000;
  return Object.values(doc.nodes)
    .filter(
      (n) => !n.project && !structural.has(n.id) && !archived.has(n.id) && !inboxIds.has(n.id) && isOpen(n),
    )
    .filter((n) => {
      const t = lastTouched(n);
      return t !== null && new Date(t).getTime() < cutoff;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
