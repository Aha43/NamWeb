import { describe, expect, it } from 'vitest';
import { formatAge, formatDate, formatDueHint, parseFlexibleDate } from './dates';

describe('parseFlexibleDate', () => {
  it('expands 2-digit years and zero-pads month/day', () => {
    expect(parseFlexibleDate('26-7-4')).toBe('2026-07-04');
    expect(parseFlexibleDate('26-06-2')).toBe('2026-06-02');
  });

  it('accepts full ISO and / or . separators', () => {
    expect(parseFlexibleDate('2026-06-15')).toBe('2026-06-15');
    expect(parseFlexibleDate('2026/6/15')).toBe('2026-06-15');
    expect(parseFlexibleDate('26.12.31')).toBe('2026-12-31');
  });

  it('returns null for blank, malformed, or impossible dates', () => {
    expect(parseFlexibleDate('')).toBeNull();
    expect(parseFlexibleDate('   ')).toBeNull();
    expect(parseFlexibleDate('2026-06')).toBeNull();
    expect(parseFlexibleDate('not a date')).toBeNull();
    expect(parseFlexibleDate('2026-13-01')).toBeNull();
    expect(parseFlexibleDate('2026-02-31')).toBeNull();
  });
});

describe('formatDate', () => {
  it('renders each format', () => {
    expect(formatDate('2026-06-14', 'medium')).toBe('Jun 14, 2026');
    expect(formatDate('2026-06-14', 'iso')).toBe('2026-06-14');
    expect(formatDate('2026-06-14', 'dmy')).toBe('14/06/2026');
    expect(formatDate('2026-06-14', 'mdy')).toBe('06/14/2026');
  });

  it('defaults to medium and passes non-ISO input through unchanged', () => {
    expect(formatDate('2026-06-14')).toBe('Jun 14, 2026');
    expect(formatDate('not a date', 'iso')).toBe('not a date');
  });
});

describe('formatDueHint', () => {
  const now = new Date(2026, 5, 11); // 2026-06-11

  it('labels overdue dates with the date (overdue tone), defaulting to medium', () => {
    expect(formatDueHint('2026-06-01', now)).toEqual({ label: 'Jun 1, 2026', tone: 'overdue' });
  });

  it('labels today and near dates', () => {
    expect(formatDueHint('2026-06-11', now)).toEqual({ label: 'Today', tone: 'today' });
    expect(formatDueHint('2026-06-13', now)).toEqual({ label: '2d', tone: 'soon' });
    expect(formatDueHint('2026-06-18', now)).toEqual({ label: '7d', tone: 'soon' });
  });

  it('labels far dates with the date (later tone)', () => {
    expect(formatDueHint('2026-07-15', now)).toEqual({ label: 'Jul 15, 2026', tone: 'later' });
  });

  it('renders the date branches in the chosen format', () => {
    expect(formatDueHint('2026-07-15', now, 'iso')).toEqual({ label: '2026-07-15', tone: 'later' });
    expect(formatDueHint('2026-06-01', now, 'dmy')).toEqual({ label: '01/06/2026', tone: 'overdue' });
  });

  it('returns null for a non-ISO string', () => {
    expect(formatDueHint('26-7-4', now)).toBeNull();
  });
});

describe('formatAge', () => {
  const now = new Date(2026, 5, 11, 12, 0, 0); // 2026-06-11

  it('uses d/w/m/y buckets and flags staleness past a week', () => {
    expect(formatAge('2026-06-11T09:00:00', now)).toEqual({ label: 'today', stale: false });
    expect(formatAge('2026-06-08T12:00:00', now)).toEqual({ label: '3d', stale: false });
    expect(formatAge('2026-05-28T12:00:00', now)).toEqual({ label: '2w', stale: true });
    expect(formatAge('2026-03-11T12:00:00', now)).toEqual({ label: '3m', stale: true });
    expect(formatAge('2024-06-11T12:00:00', now)).toEqual({ label: '2y', stale: true });
  });

  it('returns null for an unparseable value', () => {
    expect(formatAge('nope', now)).toBeNull();
  });
});
