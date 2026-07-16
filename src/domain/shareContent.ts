// The project-sharing sanitizer (#759) — THE security boundary of the sharing epic
// (docs/features/project-sharing/design.md). A pure function that COPIES enabled data from
// the owner's document into a fresh guest-facing envelope. Allowlist, not blocklist: fields
// are included by name, so anything new in the document format defaults to private. Runs at
// publish time on the owner's device — never in a request path.

import type { NamNode, WorkspaceDocument } from './types';
import { canonicalTag, PRIVATE_TAG } from './systemTags';
import { effectiveDue } from './derivedDue';

/** Per-share field toggles. Defaults (design Q4): dates on, statuses off, notes on. */
export interface ShareOptions {
  includeDue: boolean;
  includeStatus: boolean;
  includeNotes: boolean;
  /** Pseudonymization salt (the share token): guest-side ids are stable across republishes
   *  of the same share but reveal nothing about workspace node ids. */
  salt: string;
  /** Publish timestamp (ISO) — passed in so the sanitizer stays pure. */
  publishedAt: string;
}

export const SHARE_DEFAULT_OPTIONS = { includeDue: true, includeStatus: false, includeNotes: true } as const;

/** A friendly date span on the guest page. Only present when the share includes dates. */
export interface ShareDue {
  start: string;
  end?: string;
  startTime?: string;
  endTime?: string;
}

/** A delegated counter on the guest page (#809): only guestEditable counters are copied —
 *  un-flagged ones are not merely read-only, they are ABSENT (absent-means-not-even-visible).
 *  `index` is the resource's position in the owner-side node, the event round-trip key. */
export interface ShareCounter {
  index: number;
  /** The packed machine value ("3/10", unlimited "14/12+") — the guest pill parses it. */
  value: string;
  label?: string;
}

/** One doable thing on the guest page. */
export interface ShareItem {
  id: string;
  title: string;
  note?: string;
  due?: ShareDue;
  /** Present (true) only when the share includes statuses and the item is done. */
  done?: boolean;
  counters?: ShareCounter[];
}

/** A sub-project rendered as a section. */
export interface ShareSection {
  id: string;
  title: string;
  note?: string;
  due?: ShareDue;
  counters?: ShareCounter[];
  items: ShareItem[];
  sections: ShareSection[];
}

/** The guest renderer's whole world — versioned independently of the workspace format. */
export interface ShareContent {
  version: 1;
  title: string;
  note?: string;
  due?: ShareDue;
  publishedAt: string;
  items: ShareItem[];
  sections: ShareSection[];
}

/** FNV-1a (32-bit, hex) over `salt:id` — deterministic pseudonymous guest ids. Not
 *  cryptographic and doesn't need to be: workspace node ids grant nothing, and the goal is
 *  only that guest markup never carries them verbatim. */
function pseudoId(salt: string, id: string): string {
  const input = `${salt}:${id}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function isPrivate(node: NamNode): boolean {
  return node.tags.some((tag) => canonicalTag(tag) === PRIVATE_TAG);
}

/** Excluded regardless of toggles: private subtrees, cancelled and archived work. Done stays
 *  (a trip page showing progress is a feature); statuses only *render* when enabled. */
function isExcluded(node: NamNode): boolean {
  return isPrivate(node) || node.status === 'CANCELLED' || node.status === 'ARCHIVED';
}

/** The delegated counters of a node — empty for everything not explicitly handed over. */
function nodeCounters(node: NamNode): ShareCounter[] {
  const counters: ShareCounter[] = [];
  node.resources.forEach((r, index) => {
    if (r.type !== 'COUNT' || !r.guestEditable) return;
    const counter: ShareCounter = { index, value: r.value };
    if (r.description) counter.label = r.description;
    counters.push(counter);
  });
  return counters;
}

function itemDue(node: NamNode): ShareDue | undefined {
  if (!node.dueAt) return undefined;
  const due: ShareDue = { start: node.dueAt };
  if (node.dueEndAt) due.end = node.dueEndAt;
  if (node.dueTime) due.startTime = node.dueTime;
  if (node.dueEndAt && node.dueEndTime) due.endTime = node.dueEndTime;
  return due;
}

/** Project spans honor derive-from-contents (#706) — derived time is the trip page's best
 *  trick. Spans are computed over the PRUNED subtree (#772/F1): a private child's dates must
 *  not shape a derived span — min/max of one item IS that item's value. */
function sectionDue(doc: WorkspaceDocument, id: string): ShareDue | undefined {
  const eff = effectiveDue(doc, id, isExcluded);
  if (!eff.dueAt) return undefined;
  const due: ShareDue = { start: eff.dueAt };
  if (eff.dueEndAt) due.end = eff.dueEndAt;
  if (eff.dueTime) due.startTime = eff.dueTime;
  if (eff.dueEndAt && eff.dueEndTime) due.endTime = eff.dueEndTime;
  return due;
}

/**
 * Sanitize one project into its guest-facing snapshot. Returns null when `projectId` is not
 * an existing, non-excluded project — a private root has nothing to publish.
 */
export function shareContent(
  doc: WorkspaceDocument,
  projectId: string,
  options: ShareOptions,
): ShareContent | null {
  const root = doc.nodes[projectId];
  if (!root || !root.project || isExcluded(root)) return null;

  function buildItem(node: NamNode): ShareItem {
    const item: ShareItem = { id: pseudoId(options.salt, node.id), title: node.title };
    if (options.includeNotes && node.description) item.note = node.description;
    if (options.includeDue) {
      const due = itemDue(node);
      if (due) item.due = due;
    }
    if (options.includeStatus && node.status === 'DONE') item.done = true;
    const counters = nodeCounters(node);
    if (counters.length > 0) item.counters = counters;
    return item;
  }

  // Corrupt (cyclic) documents crash Publish rather than loop (#772/F5) — owner-side only,
  // same guard derivedDue carries.
  const visited = new Set<string>([projectId]);

  function buildChildren(node: NamNode): { items: ShareItem[]; sections: ShareSection[] } {
    const items: ShareItem[] = [];
    const sections: ShareSection[] = [];
    for (const childId of node.childIds) {
      const child = doc.nodes[childId];
      if (!child || isExcluded(child) || visited.has(child.id)) continue;
      visited.add(child.id);
      if (child.project) sections.push(buildSection(child));
      else items.push(buildItem(child));
    }
    return { items, sections };
  }

  function buildSection(node: NamNode): ShareSection {
    const section: ShareSection = {
      id: pseudoId(options.salt, node.id),
      title: node.title,
      ...buildChildren(node),
    };
    if (options.includeNotes && node.description) section.note = node.description;
    if (options.includeDue) {
      const due = sectionDue(doc, node.id);
      if (due) section.due = due;
    }
    const counters = nodeCounters(node);
    if (counters.length > 0) section.counters = counters;
    return section;
  }

  const content: ShareContent = {
    version: 1,
    title: root.title,
    publishedAt: options.publishedAt,
    ...buildChildren(root),
  };
  if (options.includeNotes && root.description) content.note = root.description;
  if (options.includeDue) {
    const due = sectionDue(doc, projectId);
    if (due) content.due = due;
  }
  return content;
}
