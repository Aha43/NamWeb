// Derived project time (#706) — a pure read-model lens, never persisted. A project with
// `deriveDue` on gets its time span from the subtree's dated contents: **explicit wins per
// edge, derived fills the gaps** (a holiday can start the day you leave the house — typed —
// and end whenever the last booked item ends — derived, breathing as bookings land). Source =
// the whole subtree including DONE (a done "book flights" still marks when the trip happens),
// excluding CANCELLED and archived. Natural recursion: a deriving sub-project contributes its
// *effective* span; one with the toggle off contributes only its explicit dates, like an
// action. See docs/features/derived-project-time/design.md.

import type { NamNode, WorkspaceDocument } from './types';

/** A node's effective due fields — explicit values with derived gap-fill for deriving projects.
 *  `derivedStart`/`derivedEnd` say which edges came from the contents (derived edges are
 *  date-only; times ride only on explicit edges). */
export interface EffectiveDue {
  dueAt: string | null;
  dueEndAt: string | null;
  dueTime: string | null;
  dueEndTime: string | null;
  derivedStart: boolean;
  derivedEnd: boolean;
}

type Span = [start: string, end: string];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function explicitStartOf(n: NamNode): string | null {
  return n.dueAt && DATE.test(n.dueAt) ? n.dueAt : null;
}

/** The explicit end — only meaningful with a start and `end >= start` (the #438 range rule). */
function explicitEndOf(n: NamNode): string | null {
  const start = explicitStartOf(n);
  return start && n.dueEndAt && DATE.test(n.dueEndAt) && n.dueEndAt >= start ? n.dueEndAt : null;
}

function union(a: Span | null, b: Span | null): Span | null {
  if (!a) return b;
  if (!b) return a;
  return [a[0] <= b[0] ? a[0] : b[0], a[1] >= b[1] ? a[1] : b[1]];
}

/**
 * A node's effective [start, end] (end falls back to start for a single date), or null when it
 * has none. This is also what the node contributes to a deriving parent — its *effective* span,
 * so deriving sub-projects compose upward. `memo` caches per traversal; documents are trees
 * (the pre-seed just guards a corrupt one against infinite recursion).
 */
function effectiveSpan(doc: WorkspaceDocument, n: NamNode, memo: Map<string, Span | null>): Span | null {
  const cached = memo.get(n.id);
  if (cached !== undefined) return cached;
  memo.set(n.id, null);

  if (n.status === 'CANCELLED' || n.status === 'ARCHIVED') return null;

  const explicitStart = explicitStartOf(n);
  const explicitEnd = explicitEndOf(n);
  let span: Span | null = explicitStart ? [explicitStart, explicitEnd ?? explicitStart] : null;

  if (n.project && n.deriveDue && (!explicitStart || !explicitEnd)) {
    let derived: Span | null = null;
    for (const cid of n.childIds) {
      const child = doc.nodes[cid];
      if (child) derived = union(derived, effectiveSpan(doc, child, memo));
    }
    if (derived) {
      // Explicit wins per edge; derived fills the gaps. A derived edge never inverts the range.
      const start = explicitStart ?? derived[0];
      const end = explicitEnd ?? (derived[1] >= start ? derived[1] : start);
      span = [start, end];
    }
  }

  memo.set(n.id, span);
  return span;
}

/**
 * A node's effective due fields. Non-projects and projects with `deriveDue` off report their
 * explicit fields unchanged (both derived flags false) — bit-for-bit today's behaviour.
 */
export function effectiveDue(doc: WorkspaceDocument, id: string): EffectiveDue {
  const n = doc.nodes[id];
  const explicit: EffectiveDue = {
    dueAt: n?.dueAt ?? null,
    dueEndAt: n?.dueEndAt ?? null,
    dueTime: n?.dueTime ?? null,
    dueEndTime: n?.dueEndTime ?? null,
    derivedStart: false,
    derivedEnd: false,
  };
  if (!n || !n.project || !n.deriveDue) return explicit;

  const span = effectiveSpan(doc, n, new Map());
  if (!span) return { ...explicit, dueAt: explicitStartOf(n), dueEndAt: explicitEndOf(n) };

  const explicitStart = explicitStartOf(n);
  const explicitEnd = explicitEndOf(n);
  const [start, end] = span;
  const dueEndAt = end > start ? end : (explicitEnd === end ? end : null); // same-day span = a single date unless explicitly a range
  return {
    dueAt: start,
    dueEndAt,
    // Times ride only on explicit edges (derived edges are date-only, per the design note).
    dueTime: explicitStart === start ? (n.dueTime ?? null) : null,
    dueEndTime: explicitEnd && explicitEnd === dueEndAt ? (n.dueEndTime ?? null) : null,
    derivedStart: explicitStart !== start,
    derivedEnd: dueEndAt !== null && explicitEnd !== dueEndAt,
  };
}
