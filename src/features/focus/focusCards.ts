import { backlogItems, contextItems, nextActions, projectActions, projectPath } from '@/domain/lenses';
import type { WorkspaceDocument } from '@/domain/types';

/** What to work through: the global Next/Backlog queues, one project's open direct actions, or the
 *  active actions matching a tag filter (the Tags view's "Focus" button). */
export type FocusSource = 'next' | 'backlog' | { project: string } | { tags: string[]; nextOnly: boolean };

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
        : nextActions(doc);
  return nodes.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    path: projectPath(doc, n.id),
  }));
}
