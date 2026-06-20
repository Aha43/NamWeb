// Render a project's actions as copyable Markdown: the project title as `#` (+ its description),
// then each action as a heading with its tags and description below it. Sub-projects get their own
// heading with their actions nested a level deeper; at each level actions come before sub-projects.
// Actions are filtered by status (the dialog defaults to Next + Backlog); sub-projects with no
// matching actions are pruned. Pure + React-free (reusable by the MCP server).

import type { NamNode, NodeStatus, WorkspaceDocument } from './types';

export interface SummaryOptions {
  /** Action statuses to include. Defaults to all of NEXT / BACKLOG / DONE. */
  statuses?: NodeStatus[];
}

const heading = (level: number, text: string): string => `${'#'.repeat(Math.min(level, 6))} ${text}`;

/** Markdown summary of `projectId` and its descendant actions. Empty string if the node is gone. */
export function projectSummaryMarkdown(
  doc: WorkspaceDocument,
  projectId: string,
  options: SummaryOptions = {},
): string {
  const project = doc.nodes[projectId];
  if (!project) return '';
  const statuses = new Set<NodeStatus>(options.statuses ?? ['NEXT', 'BACKLOG', 'DONE']);

  // Blocks for one parent's descendants; returns [] when nothing matches (so empty sub-projects prune).
  const walk = (parentId: string, level: number): string[] => {
    const parent = doc.nodes[parentId];
    if (!parent) return [];
    const children = parent.childIds
      .map((id) => doc.nodes[id])
      .filter((n): n is NamNode => Boolean(n));
    const out: string[] = [];

    // Actions first (filtered by status); each gets a heading, its tags, then its description.
    for (const action of children.filter((n) => !n.project)) {
      if (!statuses.has(action.status)) continue;
      out.push(heading(level, action.title));
      if (action.tags.length > 0) out.push(`_Tags: ${action.tags.join(', ')}_`);
      const d = action.description?.trim();
      if (d) out.push(d);
    }

    // Then sub-projects — only when they actually contain matching actions.
    for (const sub of children.filter((n) => n.project)) {
      const subBlocks = walk(sub.id, level + 1);
      if (subBlocks.length === 0) continue;
      out.push(heading(level, sub.title));
      const d = sub.description?.trim();
      if (d) out.push(d);
      out.push(...subBlocks);
    }
    return out;
  };

  const blocks: string[] = [heading(1, project.title)];
  const desc = project.description?.trim();
  if (desc) blocks.push(desc);
  blocks.push(...walk(projectId, 2));

  return blocks.join('\n\n') + '\n';
}
