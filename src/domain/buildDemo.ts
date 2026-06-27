// The demo workspace seed: a curated, populated document a visitor lands in when they "try the
// demo" — no account, no backend (see docs/features/demo-workspace/design.md). Relatable
// everyday-life projects (a trip, getting a dog) plus the Learn NAM project, chosen so every view
// lights up (Next, Backlog, Due across all groups, Blocked, Done, Tags, Focus) and project tags
// visibly "rub off" onto their actions. React-free; built from the same intents the app uses.

import { applyIntent, type SeedNode } from './mutations';
import { createDefaultWorkspace } from './createWorkspace';
import { buildLearnNam } from './learnNam';
import type { WorkspaceDocument } from './types';

/** Build the demo workspace document (structural skeleton + seeded sample content). */
export function buildDemo(newId: () => string, now: Date): WorkspaceDocument {
  const nowIso = now.toISOString();
  // Date-only, in *local* time — matches how dueGroups parses NamNode.dueAt (local midnight).
  const dueIn = (days: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // A timestamp `days` in the past, so inbox captures show a little age variety (formatAge).
  const agoIso = (days: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  // A date on a given day of a month `monthOffset` from now (local), for the calendar-board demo.
  const inMonth = (monthOffset: number, day: number): string => {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, day);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  // The month name `monthOffset` from now (e.g. "June") — used as month sub-project titles.
  const monthName = (monthOffset: number): string =>
    new Date(now.getFullYear(), now.getMonth() + monthOffset, 1).toLocaleString('en-US', { month: 'long' });

  // Captured up-front so the deposit can be blocked by reserving the hotel (by id, within the seed).
  const reserveHotelId = newId();

  const vacation: SeedNode = {
    id: newId(),
    title: 'Vacation in Italy 🇮🇹',
    project: true,
    tags: ['travel'],
    description: 'Plan the trip — a couple of weeks in early autumn.',
    children: [
      { id: newId(), title: 'Book flights', status: 'NEXT', dueAt: dueIn(5) }, // this week
      { id: reserveHotelId, title: 'Reserve a hotel', status: 'NEXT' },
      { id: newId(), title: 'Pay the deposit', status: 'BACKLOG', blockedBy: [reserveHotelId] }, // blocked
      { id: newId(), title: 'Pick the dates', status: 'DONE' }, // done
      {
        id: newId(),
        title: 'Packing',
        project: true,
        children: [
          { id: newId(), title: 'Buy a plug adapter', status: 'BACKLOG' },
          { id: newId(), title: 'Refill medications', status: 'NEXT', dueAt: dueIn(2) }, // this week
        ],
      },
    ],
  };

  const dog: SeedNode = {
    id: newId(),
    title: 'Getting a dog 🐶',
    project: true,
    tags: ['home'],
    description: 'Figure out whether we are ready — and do it right.',
    children: [
      { id: newId(), title: 'Research breeds', status: 'NEXT' },
      { id: newId(), title: 'Visit the shelter', status: 'NEXT', dueAt: dueIn(0) }, // today
      { id: newId(), title: 'Puppy-proof the house', status: 'BACKLOG' },
    ],
  };

  // A calendar-board project: months as sub-projects, each holding dated cards (the workflow behind
  // epic #439). Open it in Column view → one column per month; toggle "By due" to order each column's
  // cards by date. The direct actions and every month's cards are listed deliberately *out* of date
  // order, with one undated direct action, so the By-due sort is visibly different from manual (#437).
  const gardenBoard: SeedNode = {
    id: newId(),
    title: 'Garden makeover 🌿',
    project: true,
    tags: ['home'],
    description: 'A month-by-month plan — open in Column view and use “By due” to order each month by date.',
    children: [
      { id: newId(), title: 'Pick new plants', status: 'NEXT', dueAt: inMonth(0, 25) },
      { id: newId(), title: 'Get quotes from landscapers', status: 'NEXT', dueAt: inMonth(0, 10) },
      { id: newId(), title: 'Decide on a budget', status: 'BACKLOG' }, // undated → sorts last
      { id: newId(), title: 'Measure the back fence', status: 'NEXT', dueAt: inMonth(0, 18) },
      {
        id: newId(),
        title: monthName(0),
        project: true,
        children: [
          { id: newId(), title: 'Clear the old beds', status: 'BACKLOG', dueAt: inMonth(0, 20) },
          { id: newId(), title: 'Order soil & mulch', status: 'BACKLOG', dueAt: inMonth(0, 6) },
        ],
      },
      {
        id: newId(),
        title: monthName(1),
        project: true,
        children: [
          { id: newId(), title: 'Plant the hedges', status: 'BACKLOG', dueAt: inMonth(1, 14) },
          { id: newId(), title: 'Build raised beds', status: 'BACKLOG', dueAt: inMonth(1, 3) },
          { id: newId(), title: 'Install drip irrigation', status: 'BACKLOG', dueAt: inMonth(1, 22) },
        ],
      },
      {
        id: newId(),
        title: monthName(2),
        project: true,
        children: [
          { id: newId(), title: 'Lay the patio', status: 'BACKLOG', dueAt: inMonth(2, 9) },
          { id: newId(), title: 'Set up garden lighting', status: 'BACKLOG', dueAt: inMonth(2, 17) },
        ],
      },
    ],
  };

  // Loose actions (no project) to fill Next/Backlog and the tag list.
  const freeActions: SeedNode[] = [
    { id: newId(), title: 'Call the dentist', status: 'NEXT', tags: ['@phone'], dueAt: dueIn(-2) }, // overdue
    { id: newId(), title: 'Pick up dry cleaning', status: 'NEXT', tags: ['@errand'] },
    { id: newId(), title: 'Plan Q3 goals', status: 'BACKLOG', dueAt: dueIn(40) }, // later
  ];

  let doc = createDefaultWorkspace();
  doc = applyIntent(doc, { type: 'seedProject', parentId: doc.projectsNodeId, nodes: [vacation, dog, gardenBoard], now: nowIso });
  // The Learn NAM project teaches the method, alongside the relatable sample projects.
  doc = applyIntent(doc, { type: 'seedProject', parentId: doc.projectsNodeId, nodes: [buildLearnNam(newId, now)], now: nowIso });
  doc = applyIntent(doc, { type: 'seedProject', parentId: doc.nextActionsNodeId, nodes: freeActions, now: nowIso });

  // A few raw captures waiting in the Inbox to clarify — some are clearly an action, one is more of
  // a project, and one belongs under an existing project (great for trying the clarify deck). Added
  // oldest-first with atTop:false so the listed order is preserved (newest at the bottom).
  const inboxCaptures: { title: string; ago: number }[] = [
    { title: 'Email Sara about the long weekend', ago: 3 },
    { title: 'Look into an Italian phrasebook app', ago: 2 },
    { title: 'Birthday gift for Mom 🎁', ago: 1 },
    { title: 'Idea: start a weekly meal plan', ago: 0 },
  ];
  for (const capture of inboxCaptures) {
    doc = applyIntent(doc, { type: 'addInboxItem', id: newId(), title: capture.title, atTop: false, now: agoIso(capture.ago) });
  }

  // Two toolbar bookmarks to show the feature on load: a project, and a tag filter. (Colors inlined
  // from the bookmark palette — domain code stays free of the feature layer.)
  doc = applyIntent(doc, {
    type: 'addBookmark',
    bookmark: { id: newId(), label: vacation.title, kind: 'project', projectId: vacation.id, color: '#3b82f6' },
  });
  doc = applyIntent(doc, {
    type: 'addBookmark',
    bookmark: { id: newId(), label: '#home', kind: 'tagFilter', tags: ['home'], nextOnly: false, color: '#10b981' },
  });
  return doc;
}
