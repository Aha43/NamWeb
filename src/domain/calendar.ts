// The global calendar's read model (#675) — pure lenses over the workspace document, separate
// from lenses.ts so the calendar's date math stays in one place. "Open" mirrors the Due view's
// notion: non-project, non-structural, not DONE/CANCELLED, not in an archived subtree, and
// carrying a due date. A date-range action (dueAt..dueEndAt) counts on EVERY day of its range —
// that's what ranges are for. All dates are local-date strings (YYYY-MM-DD), compared as strings
// (ISO order == chronological order).

import type { NamNode, WorkspaceDocument } from './types';
import { archivedNodeIds, structuralNodeIds } from './lenses';

export interface CalendarDay {
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** Open actions due on this day (ranges cover each day they span). */
  count: number;
  /** The day is in the past and still has open work — the warning color. */
  overdue: boolean;
  /** Titles of the day's open actions, title-sorted — feeds the day tooltip (#689). */
  titles: string[];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local YYYY-MM-DD for a Date. */
export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function openDatedActions(doc: WorkspaceDocument): NamNode[] {
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  return Object.values(doc.nodes).filter(
    (n) =>
      !n.project &&
      !structural.has(n.id) &&
      !archived.has(n.id) &&
      n.status !== 'DONE' &&
      n.status !== 'CANCELLED' &&
      !!n.dueAt &&
      /^\d{4}-\d{2}-\d{2}$/.test(n.dueAt),
  );
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
  const today = localDateString(now);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    const titles = actions
      .filter((n) => coversDay(n, date))
      .map((n) => n.title)
      .sort((a, b) => a.localeCompare(b));
    days.push({ date, count: titles.length, overdue: titles.length > 0 && date < today, titles });
  }
  return days;
}

/** The open actions due on `date` (range-aware), title-sorted for a stable list (#676). */
export function dayActions(doc: WorkspaceDocument, date: string): NamNode[] {
  return openDatedActions(doc)
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
