// The project-sharing sanitizer (#759) — THE security boundary of the sharing epic
// (docs/features/project-sharing/design.md). A pure function that COPIES enabled data from
// the owner's document into a fresh guest-facing envelope. Allowlist, not blocklist: fields
// are included by name, so anything new in the document format defaults to private. Runs at
// publish time on the owner's device — never in a request path.

import type { NamNode, WorkspaceDocument } from './types';
import { canonicalTag, SHARED_HIDE_TAG } from './systemTags';
import { parseQuestion } from './resourceQuestion';
import { effectiveDue } from './derivedDue';

/** Per-share field toggles. Defaults (design Q4): dates on, statuses off, notes on. */
export interface ShareOptions {
  includeDue: boolean;
  includeStatus: boolean;
  includeNotes: boolean;
  /** The fourth toggle (#817): when false, DONE subtrees stay home — a shopping list wants
   *  got-enough = gone; a trip page wants progress shown. Optional, absent means true (every
   *  share published before the toggle existed keeps its behavior). */
  includeDone?: boolean;
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

/** A delegated question on the guest page (#827): guest-answerable tri-state. Only
 *  guestEditable QUESTIONs are copied; `index` is the event round-trip key. */
export interface ShareQuestion {
  index: number;
  /** The question text (humans). */
  question: string;
  /** The packed answer ("yes" / "no" / "?"). */
  value: string;
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
  questions?: ShareQuestion[];
}

/** A sub-project rendered as a section. */
export interface ShareSection {
  id: string;
  title: string;
  note?: string;
  due?: ShareDue;
  counters?: ShareCounter[];
  questions?: ShareQuestion[];
  items: ShareItem[];
  sections: ShareSection[];
}

/** The publish-time toggles, embedded in the snapshot (#823/P2): the dialog re-seeds its
 *  controls from here — a share published with "Hide completed" must not open dirty and
 *  silently re-expose hidden items on a routine republish. Nothing here is secret (all four
 *  are derivable from what the page shows). */
export interface ShareContentOptions {
  includeDue: boolean;
  includeStatus: boolean;
  includeNotes: boolean;
  includeDone: boolean;
}

/** The guest renderer's whole world — versioned independently of the workspace format. */
export interface ShareContent {
  version: 1;
  title: string;
  note?: string;
  due?: ShareDue;
  publishedAt: string;
  /** Absent on pre-#823 snapshots — the dialog falls back to defaults then. */
  options?: ShareContentOptions;
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

function isHidden(node: NamNode): boolean {
  return node.tags.some((tag) => canonicalTag(tag) === SHARED_HIDE_TAG);
}

/** Excluded regardless of toggles: private subtrees, cancelled and archived work. Done stays
 *  (a trip page showing progress is a feature); statuses only *render* when enabled. */
function isExcluded(node: NamNode): boolean {
  return isHidden(node) || node.status === 'CANCELLED' || node.status === 'ARCHIVED';
}

/** The delegated questions of a node — only guestEditable QUESTIONs with text. */
function nodeQuestions(node: NamNode): ShareQuestion[] {
  const questions: ShareQuestion[] = [];
  node.resources.forEach((r, index) => {
    if (r.type !== 'QUESTION' || !r.guestEditable || !r.description?.trim()) return;
    if (!parseQuestion(r.value)) return;
    questions.push({ index, question: r.description, value: r.value });
  });
  return questions;
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
function sectionDue(doc: WorkspaceDocument, id: string, excluded: (node: NamNode) => boolean): ShareDue | undefined {
  const eff = effectiveDue(doc, id, excluded);
  if (!eff.dueAt) return undefined;
  const due: ShareDue = { start: eff.dueAt };
  if (eff.dueEndAt) due.end = eff.dueEndAt;
  if (eff.dueTime) due.startTime = eff.dueTime;
  if (eff.dueEndAt && eff.dueEndTime) due.endTime = eff.dueEndTime;
  return due;
}

/**
 * The drain's reverse map (#811): pseudonymous guest id → real node id, over the SAME
 * traversal and exclusions as the sanitizer (the owner holds the token — the salt — so the
 * mapping is recomputable). Excluded/unknown guest ids simply aren't in the map.
 */
export function guestIdMap(doc: WorkspaceDocument, projectId: string, salt: string): Map<string, string> {
  const map = new Map<string, string>();
  const root = doc.nodes[projectId];
  if (!root || !root.project || isExcluded(root)) return map;
  const visited = new Set<string>([projectId]);
  map.set(pseudoId(salt, projectId), projectId);
  const walk = (node: NamNode) => {
    for (const childId of node.childIds) {
      const child = doc.nodes[childId];
      // Base exclusions only — deliberately NOT the per-share hideDone filter: an item hidden
      // as done still legitimately receives a late guest tick, and the drain must land it.
      if (!child || isExcluded(child) || visited.has(child.id)) continue;
      visited.add(child.id);
      map.set(pseudoId(salt, child.id), child.id);
      walk(child);
    }
  };
  walk(root);
  return map;
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
  const hideDone = options.includeDone === false;
  const excluded = (node: NamNode) => isExcluded(node) || (hideDone && node.status === 'DONE');
  const root = doc.nodes[projectId];
  if (!root || !root.project || excluded(root)) return null;

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
    const questions = nodeQuestions(node);
    if (questions.length > 0) item.questions = questions;
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
      if (!child || excluded(child) || visited.has(child.id)) continue;
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
      const due = sectionDue(doc, node.id, excluded);
      if (due) section.due = due;
    }
    const counters = nodeCounters(node);
    if (counters.length > 0) section.counters = counters;
    const questions = nodeQuestions(node);
    if (questions.length > 0) section.questions = questions;
    return section;
  }

  const content: ShareContent = {
    version: 1,
    title: root.title,
    publishedAt: options.publishedAt,
    options: {
      includeDue: options.includeDue,
      includeStatus: options.includeStatus,
      includeNotes: options.includeNotes,
      includeDone: options.includeDone !== false,
    },
    ...buildChildren(root),
  };
  if (options.includeNotes && root.description) content.note = root.description;
  if (options.includeDue) {
    const due = sectionDue(doc, projectId, excluded);
    if (due) content.due = due;
  }
  return content;
}
