import { describe, expect, it } from 'vitest';
import { formatDueHint, parseFlexibleDate } from './dates';

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

describe('formatDueHint', () => {
  const now = new Date(2026, 5, 11); // 2026-06-11

  it('labels overdue dates with the short date (overdue tone)', () => {
    expect(formatDueHint('2026-06-01', now)).toEqual({ label: 'Jun 1', tone: 'overdue' });
  });

  it('labels today and near dates', () => {
    expect(formatDueHint('2026-06-11', now)).toEqual({ label: 'Today', tone: 'today' });
    expect(formatDueHint('2026-06-13', now)).toEqual({ label: '2d', tone: 'soon' });
    expect(formatDueHint('2026-06-18', now)).toEqual({ label: '7d', tone: 'soon' });
  });

  it('labels far dates with the short date (later tone)', () => {
    expect(formatDueHint('2026-07-15', now)).toEqual({ label: 'Jul 15', tone: 'later' });
  });

  it('returns null for a non-ISO string', () => {
    expect(formatDueHint('26-7-4', now)).toBeNull();
  });
});
