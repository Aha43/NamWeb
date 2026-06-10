import { backlogItems, nextActions, projectPath } from '@/domain/lenses';
import type { WorkspaceDocument } from '@/domain/types';

export type FocusSource = 'next' | 'backlog';

export interface FocusCard {
  id: string;
  title: string;
  description: string | null;
  path: string[];
}

/** Build the execution queue for a source lens, in the lens's order. */
export function focusCards(doc: WorkspaceDocument, source: FocusSource): FocusCard[] {
  const nodes = source === 'backlog' ? backlogItems(doc) : nextActions(doc);
  return nodes.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    path: projectPath(doc, n.id),
  }));
}
