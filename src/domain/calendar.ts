// The global calendar's read model (#675) — pure lenses over the workspace document, separate
// from lenses.ts so the calendar's date math stays in one place. "Open" mirrors the Due view's
// notion: non-structural, not DONE/CANCELLED, not in an archived subtree, and carrying a due
// date. A date-range node (dueAt..dueEndAt) counts on EVERY day of its range — that's what
// ranges are for; projects mark their full span the same way (#703). All dates are local-date
// strings (YYYY-MM-DD), compared as strings (ISO order == chronological order).

import type { NamNode, WorkspaceDocument } from './types';
import { archivedNodeIds, structuralNodeIds } from './lenses';

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

function openDatedNodes(doc: WorkspaceDocument, projects: boolean): NamNode[] {
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  return Object.values(doc.nodes).filter(
    (n) =>
      n.project === projects &&
      !structural.has(n.id) &&
      !archived.has(n.id) &&
      n.status !== 'DONE' &&
      n.status !== 'CANCELLED' &&
      !!n.dueAt &&
      /^\d{4}-\d{2}-\d{2}$/.test(n.dueAt),
  );
}

const openDatedActions = (doc: WorkspaceDocument) => openDatedNodes(doc, false);
const openDatedProjects = (doc: WorkspaceDocument) => openDatedNodes(doc, true);

/** The titles of `nodes` covering `date`, title-sorted. */
function titlesOn(nodes: NamNode[], date: string): string[] {
  return nodes
    .filter((n) => coversDay(n, date))
    .map((n) => n.title)
    .sort((a, b) => a.localeCompare(b));
}

/** Whether an action's due day/range covers the given local date. */
function coversDay(n: NamNode, date: string): boolean {
  const start = n.dueAt!;
  const end = n.dueEndAt && n.dueEndAt >= start ? n.dueEndAt : start;
  return start <= date && date <= end;
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
): CalendarDay[] {
  const actions = openDatedActions(doc);
  const projects = openDatedProjects(doc);
  const today = localDateString(now);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    const titles = titlesOn(actions, date);
    days.push({
      date,
      count: titles.length,
      overdue: titles.length > 0 && date < today,
      titles,
      projectTitles: titlesOn(projects, date),
    });
  }
  return days;
}

/** The open actions due on `date` (range-aware), title-sorted for a stable list (#676). */
export function dayActions(doc: WorkspaceDocument, date: string): NamNode[] {
  return openDatedActions(doc)
    .filter((n) => coversDay(n, date))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** The open dated projects covering `date` (full span), title-sorted — the day drill-in's
 *  Projects section (#703). */
export function dayProjects(doc: WorkspaceDocument, date: string): NamNode[] {
  return openDatedProjects(doc)
    .filter((n) => coversDay(n, date))
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
