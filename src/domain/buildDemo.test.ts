import { describe, expect, it } from 'vitest';
import { buildDemo } from './buildDemo';
import { blockedGroups, doneItems, dueGroups, effectiveTags, inboxItems, nextActions, projects } from './lenses';
import type { NamNode } from './types';

function counter(): () => string {
  let n = 0;
  return () => `id${n++}`;
}

// Local noon, explicit components → no parse/timezone ambiguity against dueGroups' local parsing.
const NOW = new Date(2026, 5, 24, 12, 0, 0);

describe('buildDemo', () => {
  const doc = buildDemo(counter(), NOW);
  const byTitle = (t: string): NamNode => {
    const n = Object.values(doc.nodes).find((x) => x.title === t);
    if (!n) throw new Error(`no node titled ${t}`);
    return n;
  };

  it('seeds the sample projects plus Learn NAM at the top level', () => {
    const titles = projects(doc).map((p) => p.title);
    expect(titles).toContain('Vacation in Italy 🇮🇹');
    expect(titles).toContain('Getting a dog 🐶');
    expect(titles).toContain('Learn NAM 🥋');
  });

  it('lights up Next, every Due group, Blocked, and Done', () => {
    expect(nextActions(doc).length).toBeGreaterThan(0);
    const due = dueGroups(doc, NOW);
    expect(due.overdue.length).toBeGreaterThan(0); // Call the dentist (-2)
    expect(due.today.length).toBeGreaterThan(0); // Visit the shelter (0)
    expect(due.thisWeek.length).toBeGreaterThan(0); // Book flights (+5)
    expect(due.later.length).toBeGreaterThan(0); // Plan Q3 goals (+40)
    expect(blockedGroups(doc).length).toBeGreaterThan(0); // Pay the deposit ← Reserve a hotel
    expect(doneItems(doc).map((n) => n.title)).toContain('Pick the dates');
  });

  it('seeds a few raw captures in the Inbox to clarify, in listed (oldest-first) order', () => {
    const titles = inboxItems(doc).map((n) => n.title);
    expect(titles).toEqual([
      'Email Sara about the long weekend',
      'Look into an Italian phrasebook app',
      'Birthday gift for Mom 🎁',
      'Idea: start a weekly meal plan',
    ]);
  });

  it('project tags rub off onto their actions (inherited)', () => {
    const flights = byTitle('Book flights');
    expect(flights.tags).toEqual([]); // no own tag
    expect(effectiveTags(doc, flights.id)).toContain('travel'); // inherited from the project
  });
});
