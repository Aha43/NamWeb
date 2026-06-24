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

  // Loose actions (no project) to fill Next/Backlog and the tag list.
  const freeActions: SeedNode[] = [
    { id: newId(), title: 'Call the dentist', status: 'NEXT', tags: ['@phone'], dueAt: dueIn(-2) }, // overdue
    { id: newId(), title: 'Pick up dry cleaning', status: 'NEXT', tags: ['@errand'] },
    { id: newId(), title: 'Plan Q3 goals', status: 'BACKLOG', dueAt: dueIn(40) }, // later
  ];

  let doc = createDefaultWorkspace();
  doc = applyIntent(doc, { type: 'seedProject', parentId: doc.projectsNodeId, nodes: [vacation, dog], now: nowIso });
  // The Learn NAM project teaches the method, alongside the relatable sample projects.
  doc = applyIntent(doc, { type: 'seedProject', parentId: doc.projectsNodeId, nodes: [buildLearnNam(newId, now)], now: nowIso });
  doc = applyIntent(doc, { type: 'seedProject', parentId: doc.nextActionsNodeId, nodes: freeActions, now: nowIso });
  return doc;
}
