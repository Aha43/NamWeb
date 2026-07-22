// The global calendar's read model (#675) — pure lenses over the workspace document, separate
// from lenses.ts so the calendar's date math stays in one place. "Open" mirrors the Due view's
// notion: non-structural, not DONE/CANCELLED, not in an archived subtree, and carrying a due
// date. A date-range node (dueAt..dueEndAt) counts on EVERY day of its range — that's what
// ranges are for; projects mark their full span the same way (#703). All dates are local-date
// strings (YYYY-MM-DD), compared as strings (ISO order == chronological order).

import type { NamNode, WorkspaceDocument } from './types';
import { archivedNodeIds, structuralNodeIds } from './lenses';
import { effectiveDue } from './derivedDue';

export interface CalendarDay {
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** Open actions due on this day (ranges cover each day they span). */
  count: number;
  /** The day is in the past and still has open work — the warning color. Actions only: a long
   *  project span shouldn't paint its past days red (#703). */
  overdue: boolean;
  /** Titles of the day's open actions, title-sorted — feeds the day tooltip (#689). */
  titles: string[];
  /** Titles of the day's open dated projects (full span), title-sorted — the grid's folder
   *  marker + the tooltip's projects group (#703). */
  projectTitles: string[];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local YYYY-MM-DD for a Date. */
export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whether a string is a real local calendar date — shape alone lets `2026-99-99` (Invalid Date,
 *  formatters throw) and `2026-02-31` (silently rolls into March) through, so round-trip via Date
 *  and require the components to survive (#696). */
export function isValidLocalDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && localDateString(d) === s;
}

// `includeDone` lifts the DONE/CANCELLED filter (the "Show done" toggle, #868) — archived subtrees
// and structural containers stay excluded regardless. Default off, so the calendar shows only open
// work as before.
function openNodes(doc: WorkspaceDocument, projects: boolean, includeDone: boolean): NamNode[] {
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  return Object.values(doc.nodes).filter(
    (n) =>
      n.project === projects &&
      !structural.has(n.id) &&
      !archived.has(n.id) &&
      (includeDone || (n.status !== 'DONE' && n.status !== 'CANCELLED')),
  );
}

function openDatedActions(doc: WorkspaceDocument, includeDone: boolean): NamNode[] {
  return openNodes(doc, false, includeDone).filter((n) => !!n.dueAt && /^\d{4}-\d{2}-\d{2}$/.test(n.dueAt));
}

/** A dated node with its resolved [start, end] span — for projects the *effective* span, so a
 *  deriving project (#706) marks the calendar just like an explicitly dated one. */
interface Dated {
  node: NamNode;
  start: string;
  end: string;
}

function datedActions(doc: WorkspaceDocument, includeDone: boolean): Dated[] {
  return openDatedActions(doc, includeDone).map((n) => ({
    node: n,
    start: n.dueAt!,
    end: n.dueEndAt && n.dueEndAt >= n.dueAt! ? n.dueEndAt : n.dueAt!,
  }));
}

function datedProjects(doc: WorkspaceDocument, includeDone: boolean): Dated[] {
  const out: Dated[] = [];
  for (const n of openNodes(doc, true, includeDone)) {
    const eff = effectiveDue(doc, n.id);
    if (!eff.dueAt || !/^\d{4}-\d{2}-\d{2}$/.test(eff.dueAt)) continue;
    out.push({ node: n, start: eff.dueAt, end: eff.dueEndAt && eff.dueEndAt >= eff.dueAt ? eff.dueEndAt : eff.dueAt });
  }
  return out;
}

/** The titles of `dated` entries covering `date`, title-sorted. */
function titlesOn(dated: Dated[], date: string): string[] {
  return dated
    .filter((d) => d.start <= date && date <= d.end)
    .map((d) => d.node.title)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * One entry per day of the given month (`month` is 1-12), in order. `now` decides which days
 * count as past for the overdue warning.
 */
export function calendarMonth(
  doc: WorkspaceDocument,
  year: number,
  month: number,
  now: Date = new Date(),
  includeDone = false,
): CalendarDay[] {
  const actions = datedActions(doc, includeDone);
  const projects = datedProjects(doc, includeDone);
  // Overdue red is about *open* work waiting in the past — a day carrying only done actions must
  // not glow red just because "Show done" is on (#868). When done is hidden the two sets coincide.
  const openActions = includeDone ? datedActions(doc, false) : actions;
  const today = localDateString(now);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    const titles = titlesOn(actions, date);
    days.push({
      date,
      count: titles.length,
      overdue: date < today && titlesOn(openActions, date).length > 0,
      titles,
      projectTitles: titlesOn(projects, date),
    });
  }
  return days;
}

/** The actions due on `date` (range-aware), title-sorted for a stable list (#676). Open only unless
 *  `includeDone` is set (the "Show done" toggle, #868). */
export function dayActions(doc: WorkspaceDocument, date: string, includeDone = false): NamNode[] {
  return datedActions(doc, includeDone)
    .filter((d) => d.start <= date && date <= d.end)
    .map((d) => d.node)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** The dated projects covering `date` (full effective span, #706), title-sorted — the day
 *  drill-in's Projects section (#703). Open only unless `includeDone` is set (#868). */
export function dayProjects(doc: WorkspaceDocument, date: string, includeDone = false): NamNode[] {
  return datedProjects(doc, includeDone)
    .filter((d) => d.start <= date && date <= d.end)
    .map((d) => d.node)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** ISO 8601 week number (Monday-start; week 1 holds the year's first Thursday) — the Norwegian
 *  convention, used by the month grid's week gutter (#680). */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // shift to the week's Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
