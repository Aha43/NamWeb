// The "Learn NAM 🥋" onboarding project: real tasks you complete *on this very project* to learn
// each feature. Finish them all and the heat map goes green — your NAM green belt. Seeded via the
// `seedProject` intent. React-free (reusable by the MCP server); ids/dates are passed in so the
// resulting intent stays pure and replayable.

import type { SeedNode } from './mutations';

/** Build the Learn NAM project subtree, resolved to concrete ids + dates. */
export function buildLearnNam(newId: () => string, now: Date): SeedNode {
  const dueIn = (days: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10); // date-only, matches NamNode.dueAt
  };

  // Captured up-front so a later action can be blocked by an earlier one (by id, within the seed).
  const dueDateActionId = newId();

  return {
    id: newId(),
    title: 'Learn NAM 🥋',
    project: true,
    description:
      "A hands-on intro to NAM. Work these tasks on this very project — each one teaches a feature by " +
      'doing it. Finish them all and the heat map turns green: your NAM green belt. Delete this project ' +
      'any time to tidy up.',
    children: [
      {
        id: newId(),
        title: 'White belt — basics',
        project: true,
        children: [
          {
            id: newId(),
            title: "👋 You're here — a free Done",
            status: 'DONE',
            description:
              "This one's already done, so you can see the Done view and a slice of green on the heat map. " +
              'The rest are yours to earn.',
          },
          {
            id: newId(),
            title: 'Capture a thought',
            status: 'NEXT',
            description:
              'Tap Capture (the + ) and jot anything at all. It lands in your Inbox — NAM\'s catch-all, so ' +
              'nothing slips away.',
          },
          {
            id: newId(),
            title: 'Triage it from the Inbox',
            status: 'BACKLOG',
            description:
              'Open the Inbox and turn your capture into a Next action or a project. Triage = decide what it ' +
              'actually is.',
          },
          {
            id: newId(),
            title: 'Mark an action Done',
            status: 'NEXT',
            description:
              'Click any status badge (N/B/D) and choose Done. Watch this belt\'s card turn a little greener.',
          },
        ],
      },
      {
        id: newId(),
        title: 'Yellow belt — organize',
        project: true,
        children: [
          {
            id: newId(),
            title: 'Send an action to Backlog',
            status: 'BACKLOG',
            description:
              'Not now? Set an action\'s status to Backlog. Your Next view stays to what\'s genuinely next.',
          },
          {
            id: newId(),
            title: 'Tag an action, then filter by it',
            status: 'NEXT',
            tags: ['learn'],
            description:
              'Add a tag to an action in the editor, then open the Tags view and filter by it to round up ' +
              'everything that shares it.',
          },
          {
            id: newId(),
            title: 'Add a sub-project',
            status: 'BACKLOG',
            description:
              'Projects nest. Add a sub-project under any project to group related work — like the belts here.',
          },
        ],
      },
      {
        id: newId(),
        title: 'Green belt — power',
        project: true,
        children: [
          {
            id: newId(),
            title: 'Use Focus mode',
            status: 'NEXT',
            description:
              'Open a project and hit Focus — a calm, one-at-a-time card deck of its actions for heads-down work.',
          },
          {
            id: dueDateActionId,
            title: 'Set a due date',
            status: 'BACKLOG',
            tags: ['learn'],
            dueAt: dueIn(3),
            description:
              'Give an action a due date, then check the Due view — it groups everything by urgency.',
          },
          {
            id: newId(),
            title: 'Block one action by another',
            status: 'BACKLOG',
            blockedBy: [dueDateActionId],
            description:
              'Mark a prerequisite (this one waits on "Set a due date"). Blocked actions appear under their ' +
              'blocker in the Blocked view.',
          },
          {
            id: newId(),
            title: 'Try Column view',
            status: 'NEXT',
            resources: [{ type: 'URI', value: 'https://usenam.app', description: 'NAM on the web' }],
            description:
              'On a wide screen, switch a project to Column (kanban) view and drag actions between columns. ' +
              '(This one has a resource link — note the paperclip.)',
          },
          {
            id: newId(),
            title: 'Earn your green belt 🥋',
            status: 'BACKLOG',
            description:
              "Finish every action here. When the whole heat map is green, you've earned your NAM green belt — " +
              'then delete this project to start clean.',
          },
        ],
      },
    ],
  };
}
