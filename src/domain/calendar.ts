// The global calendar's read model (#675) — pure lenses over the workspace document, separate
// from lenses.ts so the calendar's date math stays in one place. "Open" mirrors the Due view's
// notion: non-structural, not DONE/CANCELLED, not in an archived or someday subtree, and carrying a due
// date. A date-range node (dueAt..dueEndAt) counts on EVERY day of its range — that's what
// ranges are for; projects mark their full span the same way (#703). All dates are local-date
// strings (YYYY-MM-DD), compared as strings (ISO order == chronological order).

import type { NamNode, NodeStatus, WorkspaceDocument } from './types';
import { archivedNodeIds, somedaySuppressedIds, structuralNodeIds } from './lenses';
import { effectiveDue } from './derivedDue';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Which statuses a gather keeps. The grid's "Show done" is the binary open-vs-all form; the agenda
 *  passes an explicit set from its status boxes (#995 tweak). */
type StatusKeep = (status: NodeStatus) => boolean;
const openKeep = (includeDone: boolean): StatusKeep => (s) =>
  includeDone || (s !== 'DONE' && s !== 'CANCELLED');

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

// Gather non-structural, non-archived nodes of the given kind (action/project) whose status the
// caller keeps. The grid keeps "open" (`openKeep`); the agenda keeps its status-box set.
function nodesWhere(doc: WorkspaceDocument, projects: boolean, keep: StatusKeep): NamNode[] {
  const structural = structuralNodeIds(doc);
  const archived = archivedNodeIds(doc);
  const someday = somedaySuppressedIds(doc); // #1137 — parked items leave the calendar/agenda too
  return Object.values(doc.nodes).filter(
    (n) => n.project === projects && !structural.has(n.id) && !archived.has(n.id) && !someday.has(n.id) && keep(n.status),
  );
}

/** A dated node with its resolved [start, end] span — for projects the *effective* span, so a
 *  deriving project (#706) marks the calendar just like an explicitly dated one. */
interface Dated {
  node: NamNode;
  start: string;
  end: string;
}

function datedActions(doc: WorkspaceDocument, keep: StatusKeep): Dated[] {
  return nodesWhere(doc, false, keep)
    .filter((n) => !!n.dueAt && DATE.test(n.dueAt))
    .map((n) => ({
      node: n,
      start: n.dueAt!,
      end: n.dueEndAt && n.dueEndAt >= n.dueAt! ? n.dueEndAt : n.dueAt!,
    }));
}

function datedProjects(doc: WorkspaceDocument, keep: StatusKeep): Dated[] {
  const out: Dated[] = [];
  for (const n of nodesWhere(doc, true, keep)) {
    const eff = effectiveDue(doc, n.id);
    if (!eff.dueAt || !DATE.test(eff.dueAt)) continue;
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
  const actions = datedActions(doc, openKeep(includeDone));
  const projects = datedProjects(doc, openKeep(includeDone));
  // Overdue red is about *open* work waiting in the past — a day carrying only done actions must
  // not glow red just because "Show done" is on (#868). When done is hidden the two sets coincide.
  const openActions = includeDone ? datedActions(doc, openKeep(false)) : actions;
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
  return datedActions(doc, openKeep(includeDone))
    .filter((d) => d.start <= date && date <= d.end)
    .map((d) => d.node)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** The dated projects covering `date` (full effective span, #706), title-sorted — the day
 *  drill-in's Projects section (#703). Open only unless `includeDone` is set (#868). */
export function dayProjects(doc: WorkspaceDocument, date: string, includeDone = false): NamNode[] {
  return datedProjects(doc, openKeep(includeDone))
    .filter((d) => d.start <= date && date <= d.end)
    .map((d) => d.node)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** One dated item in the agenda list (#995) — an action or a project, kept as the node so the view
 *  renders each with the right row. */
export interface AgendaEntry {
  node: NamNode;
  kind: 'action' | 'project';
}
/** A day that carries at least one dated item, with its items ordered (timed actions first, then
 *  untimed actions, then projects — all title-tie-broken). */
export interface AgendaDay {
  date: string;
  entries: AgendaEntry[];
}
/** The agenda's buckets: OPEN items whose start day is in the past (Overdue, the red warning), then
 *  today and every future day (upcoming), then past items that are done/cancelled (a neutral "Earlier"
 *  group — only when the status boxes include them). No empty days. Overdue stays open-only so a
 *  completed past item never wears the overdue warning (matching the grid, #868). */
export interface Agenda {
  overdue: AgendaDay[];
  upcoming: AgendaDay[];
  past: AgendaDay[];
}

function compareAgendaEntries(a: AgendaEntry, b: AgendaEntry): number {
  // Actions (things to do) before projects (context) within a day.
  if (a.kind !== b.kind) return a.kind === 'action' ? -1 : 1;
  if (a.kind === 'action') {
    // Timed actions in clock order; untimed sink below them (sort key past any real HH:MM).
    const ta = a.node.dueTime ?? '99:99';
    const tb = b.node.dueTime ?? '99:99';
    if (ta !== tb) return ta.localeCompare(tb);
  }
  return a.node.title.localeCompare(b.node.title);
}

/**
 * The agenda (list) view's read model (#995): every dated action + dated project, placed **once on
 * its start day** (a span's later days are conveyed by the row's due-hint label, not repeated rows —
 * repeating a long span down the list would be noise). Days with no items are omitted. `statuses` is
 * the agenda's own status-box set (NEXT/BACKLOG/DONE) — an item shows only when its status is kept.
 * Classified into: `overdue` (past + OPEN — the red warning), `upcoming` (today onward), and `past`
 * (before today + done/cancelled — a neutral group, only when those statuses are shown). Keeping
 * overdue open-only means a completed past item never wears the overdue warning (#1000 review, P2).
 */
export function agenda(doc: WorkspaceDocument, now: Date = new Date(), statuses: readonly NodeStatus[] = ['NEXT', 'BACKLOG']): Agenda {
  const keep: StatusKeep = (s) => statuses.includes(s);
  const isOpen = (s: NodeStatus) => s !== 'DONE' && s !== 'CANCELLED';
  const today = localDateString(now);
  const overdueByDay = new Map<string, AgendaEntry[]>();
  const upcomingByDay = new Map<string, AgendaEntry[]>();
  const pastByDay = new Map<string, AgendaEntry[]>();
  const add = (map: Map<string, AgendaEntry[]>, date: string, entry: AgendaEntry) => {
    const list = map.get(date);
    if (list) list.push(entry);
    else map.set(date, [entry]);
  };
  const place = (start: string, entry: AgendaEntry) => {
    if (start >= today) add(upcomingByDay, start, entry);
    else if (isOpen(entry.node.status)) add(overdueByDay, start, entry);
    else add(pastByDay, start, entry);
  };
  for (const d of datedActions(doc, keep)) place(d.start, { node: d.node, kind: 'action' });
  for (const d of datedProjects(doc, keep)) place(d.start, { node: d.node, kind: 'project' });

  const build = (map: Map<string, AgendaEntry[]>): AgendaDay[] =>
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entries]) => ({ date, entries: entries.sort(compareAgendaEntries) }));

  return { overdue: build(overdueByDay), upcoming: build(upcomingByDay), past: build(pastByDay) };
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
