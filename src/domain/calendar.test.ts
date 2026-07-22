import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { calendarMonth, dayActions, dayProjects, isValidLocalDate, isoWeek } from './calendar';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'NEXT', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function workspace(extra: NamNode[]): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {
    root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    inbox: node('inbox'),
    projects: node('projects'),
    actions: node('actions', { childIds: extra.map((n) => n.id) }),
  };
  for (const n of extra) nodes[n.id] = n;
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const NOW = new Date('2026-07-15T12:00:00');

describe('calendarMonth (#675)', () => {
  it('counts open actions per day; DONE and undated are invisible', () => {
    const doc = workspace([
      node('a', { dueAt: '2026-07-10' }),
      node('b', { dueAt: '2026-07-10' }),
      node('done', { dueAt: '2026-07-10', status: 'DONE' }),
      node('undated'),
    ]);
    const days = calendarMonth(doc, 2026, 7, NOW);
    expect(days).toHaveLength(31);
    expect(days[9]).toEqual({ date: '2026-07-10', count: 2, overdue: true, titles: ['a', 'b'], projectTitles: [] }); // past day, open work
    expect(days[10].count).toBe(0);
  });

  it('a date range covers every day it spans', () => {
    const doc = workspace([node('r', { dueAt: '2026-07-20', dueEndAt: '2026-07-22' } as Partial<NamNode>)]);
    const days = calendarMonth(doc, 2026, 7, NOW);
    expect(days[19].count).toBe(1);
    expect(days[20].count).toBe(1);
    expect(days[21].count).toBe(1);
    expect(days[22].count).toBe(0);
    expect(days[19].overdue).toBe(false); // future days are never the warning color
  });

  it('today itself is not overdue; yesterday is', () => {
    const doc = workspace([node('t', { dueAt: '2026-07-15' }), node('y', { dueAt: '2026-07-14' })]);
    const days = calendarMonth(doc, 2026, 7, NOW);
    expect(days[14]).toMatchObject({ count: 1, overdue: false });
    expect(days[13]).toMatchObject({ count: 1, overdue: true });
  });

  it("carries each day's titles, title-sorted and range-aware (#689)", () => {
    const doc = workspace([
      node('b', { title: 'Beta', dueAt: '2026-07-10' }),
      node('a', { title: 'Alpha', dueAt: '2026-07-08', dueEndAt: '2026-07-12' } as Partial<NamNode>),
    ]);
    const days = calendarMonth(doc, 2026, 7, NOW);
    expect(days[9].titles).toEqual(['Alpha', 'Beta']); // the range action covers the 10th too
    expect(days[0].titles).toEqual([]);
  });

  it('projects mark their full span separately — never the action count or the overdue tint (#703)', () => {
    const doc = workspace([
      node('p', { title: 'Reno', project: true, dueAt: '2026-07-10', dueEndAt: '2026-07-12' } as Partial<NamNode>),
      node('doneP', { title: 'Shipped', project: true, dueAt: '2026-07-10', status: 'DONE' }),
      node('a', { title: 'Act', dueAt: '2026-07-11' }),
    ]);
    const days = calendarMonth(doc, 2026, 7, NOW);
    expect(days[9]).toMatchObject({ count: 0, overdue: false, projectTitles: ['Reno'] }); // past day: project alone ≠ warning
    expect(days[10]).toMatchObject({ count: 1, titles: ['Act'], projectTitles: ['Reno'] });
    expect(days[11].projectTitles).toEqual(['Reno']);
    expect(days[12].projectTitles).toEqual([]);
  });

  it('a deriving project marks the calendar by its effective span (#706)', () => {
    const doc = workspace([
      node('p', { title: 'Trip', project: true, deriveDue: true, childIds: ['a', 'b'] } as Partial<NamNode>),
      node('a', { dueAt: '2026-07-10' }),
      node('b', { dueAt: '2026-07-12' }),
    ]);
    const days = calendarMonth(doc, 2026, 7, NOW);
    expect(days[9].projectTitles).toEqual(['Trip']);
    expect(days[10].projectTitles).toEqual(['Trip']); // full span, not just the edges
    expect(days[11].projectTitles).toEqual(['Trip']);
    expect(days[12].projectTitles).toEqual([]);
    expect(dayProjects(doc, '2026-07-11').map((n) => n.title)).toEqual(['Trip']);
  });

  it('handles month lengths (Feb of a leap year)', () => {
    const days = calendarMonth(workspace([]), 2028, 2, NOW);
    expect(days).toHaveLength(29);
    expect(days[28].date).toBe('2028-02-29');
  });

  it('includeDone surfaces DONE/CANCELLED actions and projects, but never paints them overdue (#868)', () => {
    const doc = workspace([
      node('a', { title: 'Open', dueAt: '2026-07-10' }),
      node('done', { title: 'Shipped', dueAt: '2026-07-10', status: 'DONE' }),
      node('cx', { title: 'Dropped', dueAt: '2026-07-12', status: 'CANCELLED' }),
      node('p', { title: 'Reno', project: true, dueAt: '2026-07-10', status: 'DONE' }),
    ]);
    // Hidden (default): only the open action shows.
    const off = calendarMonth(doc, 2026, 7, NOW);
    expect(off[9]).toMatchObject({ count: 1, titles: ['Open'], projectTitles: [] });
    expect(off[11].count).toBe(0);
    // Shown: done/cancelled join the count + titles, and the done project marks its span…
    const on = calendarMonth(doc, 2026, 7, NOW, true);
    expect(on[9]).toMatchObject({ count: 2, titles: ['Open', 'Shipped'], projectTitles: ['Reno'] });
    expect(on[9].overdue).toBe(true); // still an OPEN action here → warning stands
    // …but a past day carrying only a DONE/CANCELLED action must not glow red.
    expect(on[11]).toMatchObject({ count: 1, titles: ['Dropped'], overdue: false });
  });
});

describe('dayActions (#676)', () => {
  it('returns the day\'s open actions (range-aware), title-sorted', () => {
    const doc = workspace([
      node('b', { title: 'Beta', dueAt: '2026-07-10' }),
      node('a', { title: 'Alpha', dueAt: '2026-07-08', dueEndAt: '2026-07-12' } as Partial<NamNode>),
      node('x', { title: 'Other day', dueAt: '2026-07-11' }),
    ]);
    expect(dayActions(doc, '2026-07-10').map((n) => n.title)).toEqual(['Alpha', 'Beta']);
  });

  it('includeDone adds the day\'s DONE actions to the list (#868)', () => {
    const doc = workspace([
      node('a', { title: 'Open', dueAt: '2026-07-10' }),
      node('d', { title: 'Shipped', dueAt: '2026-07-10', status: 'DONE' }),
    ]);
    expect(dayActions(doc, '2026-07-10').map((n) => n.title)).toEqual(['Open']);
    expect(dayActions(doc, '2026-07-10', true).map((n) => n.title)).toEqual(['Open', 'Shipped']);
  });
});

describe('dayProjects (#703)', () => {
  it("returns the day's open dated projects (range-aware), title-sorted", () => {
    const doc = workspace([
      node('z', { title: 'Zeta', project: true, dueAt: '2026-07-10' }),
      node('a', { title: 'Alpha', project: true, dueAt: '2026-07-08', dueEndAt: '2026-07-12' } as Partial<NamNode>),
      node('other', { title: 'Elsewhere', project: true, dueAt: '2026-07-20' }),
      node('act', { title: 'An action', dueAt: '2026-07-10' }), // actions never leak in
    ]);
    expect(dayProjects(doc, '2026-07-10').map((n) => n.title)).toEqual(['Alpha', 'Zeta']);
  });
});

describe('isValidLocalDate (#696)', () => {
  it('accepts real dates, rejects shape-only impostors', () => {
    expect(isValidLocalDate('2026-07-08')).toBe(true);
    expect(isValidLocalDate('2028-02-29')).toBe(true); // leap day
    expect(isValidLocalDate('2026-99-99')).toBe(false); // Invalid Date — formatters would throw
    expect(isValidLocalDate('2026-02-31')).toBe(false); // silently rolls into March
    expect(isValidLocalDate('2026-00-10')).toBe(false);
    expect(isValidLocalDate('2026-7-8')).toBe(false); // unpadded
    expect(isValidLocalDate('garbage')).toBe(false);
  });
});

describe('isoWeek (#680)', () => {
  it('matches ISO 8601 edges', () => {
    expect(isoWeek(new Date(2026, 6, 7))).toBe(28); // Tue 2026-07-07
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1); // Thu 2026-01-01 → week 1
    expect(isoWeek(new Date(2021, 0, 1))).toBe(53); // Fri 2021-01-01 → week 53 of 2020
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1); // Mon 2024-12-30 → week 1 of 2025
  });
});
