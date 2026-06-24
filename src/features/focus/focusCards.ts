import { backlogItems, contextItems, doneItems, dueGroups, nextActions, projectActions, projectPath } from '@/domain/lenses';
import type { WorkspaceDocument } from '@/domain/types';

/** What to work through: the global Next/Backlog queues, the due-now set (overdue + today), the Done
 *  list (to re-triage mistakes), one project's open direct actions, or actions matching a tag filter. */
export type FocusSource = 'next' | 'backlog' | 'due' | 'done' | { project: string } | { tags: string[]; nextOnly: boolean };

export interface FocusCard {
  id: string;
  title: string;
  description: string | null;
  path: string[];
}

/** Build the execution queue for a source, in the source's order. */
export function focusCards(doc: WorkspaceDocument, source: FocusSource): FocusCard[] {
  const nodes =
    typeof source === 'object'
      ? 'project' in source
        ? // A project's direct actions, excluding done — mirrors NamDesktop's focusableDirectActions.
          projectActions(doc, source.project).filter((n) => n.status !== 'DONE')
        : // Active actions matching the tag filter (same set the Tags view shows).
          contextItems(doc, source.tags, source.nextOnly)
      : source === 'backlog'
        ? backlogItems(doc)
        : source === 'due'
          ? // The due-now queue: overdue first, then today's due actions.
            [...dueGroups(doc).overdue, ...dueGroups(doc).today]
          : source === 'done'
            ? doneItems(doc)
            : nextActions(doc);
  return nodes.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    path: projectPath(doc, n.id),
  }));
}
