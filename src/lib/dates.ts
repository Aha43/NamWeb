// Due-date helpers, matching NamDesktop.
//  - parseFlexibleDate: relaxed text entry, ported from NamDesktop's
//    ActionDialog.parseFlexibleDate.
//  - formatDueHint: a compact, urgency-coloured due label for list rows.
import type { TFunction } from 'i18next';

/** Optional translator for the relative-word labels; absent → English (keeps pure-lib tests simple). */
type Translate = TFunction | ((key: string, opts?: { count?: number }) => string);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** User-selectable date display format (Settings → Date format). `parseFlexibleDate` and the Due
 *  input echo stay ISO regardless — this governs display only. */
export type DateFormat = 'medium' | 'iso' | 'dmy' | 'mdy';

export const DEFAULT_DATE_FORMAT: DateFormat = 'medium';

/**
 * Render an ISO `yyyy-MM-dd` date for display in the chosen format:
 * `medium` → "Jun 14, 2026", `iso` → "2026-06-14", `dmy` → "14/06/2026", `mdy` → "06/14/2026".
 * Returns the input unchanged if it isn't an ISO date.
 */
export function formatDate(iso: string, format: DateFormat = DEFAULT_DATE_FORMAT): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, ys, ms, ds] = match;
  switch (format) {
    case 'iso':
      return `${ys}-${ms}-${ds}`;
    case 'dmy':
      return `${ds}/${ms}/${ys}`;
    case 'mdy':
      return `${ms}/${ds}/${ys}`;
    case 'medium':
    default:
      return `${MONTHS[Number(ms) - 1]} ${Number(ds)}, ${ys}`;
  }
}

/**
 * Parse a flexible due-date string to ISO `yyyy-MM-dd`. Accepts YY or YYYY year
 * and single- or double-digit month/day, separated by `-`, `/`, or `.`
 * (e.g. "2026-06-15", "26-6-15", "26/1/2"). Returns `null` for blank input and
 * for anything that isn't a real calendar date. Mirrors NamDesktop.
 */
export function parseFlexibleDate(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[-/.]/).map((p) => p.trim());
  if (parts.length !== 3) return null;
  let [year, month, day] = parts;
  if (year.length === 2) year = '20' + year;
  if (month.length === 1) month = '0' + month;
  if (day.length === 1) day = '0' + day;
  const iso = `${year}-${month}-${day}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  // Reject rolled-over values (e.g. 2026-02-31) by round-tripping through Date.
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() + 1 !== m || dt.getDate() !== d) return null;
  return iso;
}

/**
 * Parse flexible time-of-day entry to a local `"HH:MM"` (24h), à la the progressive "add hours, then
 * minutes" input: `"14"`/`"9"` → hour only (`14:00`/`09:00`), `"1430"`/`"930"` → `14:30`/`09:30`,
 * `"14:30"` / `"14.30"` → as written. Returns `null` for blank or anything out of range (hour 0–23,
 * minute 0–59). See #493.
 */
export function parseFlexibleTime(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  let h: number;
  let m: number;
  const parts = trimmed.split(/[:.]/);
  if (parts.length === 2) {
    if (!/^\d{1,2}$/.test(parts[0]) || !/^\d{1,2}$/.test(parts[1])) return null;
    h = Number(parts[0]);
    m = Number(parts[1]);
  } else if (parts.length === 1) {
    const digits = parts[0];
    if (!/^\d{1,4}$/.test(digits)) return null;
    if (digits.length <= 2) {
      h = Number(digits);
      m = 0;
    } else if (digits.length === 3) {
      h = Number(digits.slice(0, 1));
      m = Number(digits.slice(1));
    } else {
      h = Number(digits.slice(0, 2));
      m = Number(digits.slice(2));
    }
  } else {
    return null;
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later';
export interface DueHint {
  label: string;
  tone: DueTone;
}

/**
 * A compact due label + urgency tone for an ISO `yyyy-MM-dd` date, à la NamDesktop:
 * overdue → date (red), today → "Today" (amber), within a week → "Nd" (blue),
 * else date (muted). The date branches render in the chosen `format` (default `medium`).
 * Returns `null` if the input isn't an ISO date.
 */
export function formatDueHint(
  dueAt: string,
  now: Date = new Date(),
  format: DateFormat = DEFAULT_DATE_FORMAT,
  t?: Translate,
): DueHint | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueAt);
  if (!match) return null;
  const [, ys, ms, ds] = match;
  const due = new Date(Number(ys), Number(ms) - 1, Number(ds));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return { label: formatDate(dueAt, format), tone: 'overdue' };
  if (days === 0) return { label: t ? t('dates.dueToday') : 'Today', tone: 'today' };
  if (days <= 7) return { label: t ? t('dates.days', { count: days }) : `${days}d`, tone: 'soon' };
  return { label: formatDate(dueAt, format), tone: 'later' };
}

export interface AgeHint {
  label: string;
  /** Older than a week — NamDesktop highlights these in amber. */
  stale: boolean;
}

/**
 * A compact relative age (d/w/m/y) for an ISO date-time, à la NamDesktop's Age
 * column. Returns `null` if the input can't be parsed.
 */
export function formatAge(iso: string, now: Date = new Date(), t?: Translate): AgeHint | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const days = Math.floor((now.getTime() - then) / 86_400_000);
  const stale = days > 7;
  let label: string;
  if (days <= 0) label = t ? t('dates.ageToday') : 'today';
  else if (days < 7) label = t ? t('dates.days', { count: days }) : `${days}d`;
  else if (days < 30) label = t ? t('dates.weeks', { count: Math.floor(days / 7) }) : `${Math.floor(days / 7)}w`;
  else if (days < 365) label = t ? t('dates.months', { count: Math.floor(days / 30) }) : `${Math.floor(days / 30)}m`;
  else label = t ? t('dates.years', { count: Math.floor(days / 365) }) : `${Math.floor(days / 365)}y`;
  return { label, stale };
}
