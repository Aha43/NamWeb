import { backlogItems, nextActions, projectActions, projectPath } from '@/domain/lenses';
import type { WorkspaceDocument } from '@/domain/types';

/** What to work through: the global Next/Backlog queues, or one project's open direct actions. */
export type FocusSource = 'next' | 'backlog' | { project: string };

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
      ? // A project's direct actions, excluding done — mirrors NamDesktop's focusableDirectActions.
        projectActions(doc, source.project).filter((n) => n.status !== 'DONE')
      : source === 'backlog'
        ? backlogItems(doc)
        : nextActions(doc);
  return nodes.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    path: projectPath(doc, n.id),
  }));
}
