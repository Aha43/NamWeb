// Render a project's actions as copyable Markdown: the project title as `#` (+ its description),
// then each action as a heading with its description as a paragraph when present. Sub-projects get
// their own heading with their actions nested a level deeper; at each level actions come before
// sub-projects. Pure + React-free (reusable by the MCP server).

import type { NamNode, WorkspaceDocument } from './types';

const heading = (level: number, text: string): string => `${'#'.repeat(Math.min(level, 6))} ${text}`;

/** Markdown summary of `projectId` and its descendant actions. Empty string if the node is gone. */
export function projectSummaryMarkdown(doc: WorkspaceDocument, projectId: string): string {
  const project = doc.nodes[projectId];
  if (!project) return '';

  const blocks: string[] = [heading(1, project.title)];
  const desc = project.description?.trim();
  if (desc) blocks.push(desc);

  const walk = (parentId: string, level: number): void => {
    const parent = doc.nodes[parentId];
    if (!parent) return;
    const children = parent.childIds
      .map((id) => doc.nodes[id])
      .filter((n): n is NamNode => Boolean(n));
    const emit = (node: NamNode) => {
      blocks.push(heading(level, node.title));
      const d = node.description?.trim();
      if (d) blocks.push(d);
    };
    // Actions first, then sub-projects (each recursing one level deeper) — mirrors the workbench.
    for (const action of children.filter((n) => !n.project)) emit(action);
    for (const sub of children.filter((n) => n.project)) {
      emit(sub);
      walk(sub.id, level + 1);
    }
  };
  walk(projectId, 2);

  return blocks.join('\n\n') + '\n';
}
