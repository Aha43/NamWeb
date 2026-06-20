import { useNavigate } from 'react-router-dom';
import { projectPath, projects, reorderKindWithinChildren, subtreeIds } from '@/domain/lenses';
import type { NamNode } from '@/domain/types';
import { buildLearnNam } from '@/domain/learnNam';
import { newId, nowIso } from '@/lib/local';
import { ProjectsPanel } from '@/features/projects/ProjectsPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { useWorkspaceContext } from '@/store/workspace-context';

export function ProjectsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  return (
    <ProjectsPanel
      projects={document ? projects(document) : []}
      onAdd={(title) => {
        if (!document) return;
        dispatch({ type: 'addSubProject', parentId: document.projectsNodeId, id: newId(), title, now: nowIso() });
      }}
      onAddLearnNam={() => {
        if (!document) return;
        const seed = buildLearnNam(newId, new Date());
        dispatch({ type: 'seedProject', parentId: document.projectsNodeId, nodes: [seed], now: nowIso() });
        navigate(`/projects/${seed.id}`);
      }}
      onOpen={(id) => navigate(`/projects/${id}`)}
      onEdit={openEditor}
      dndEnabled={isDesktop}
      onReorder={(orderedIds) => {
        if (!document) return;
        const container = document.nodes[document.projectsNodeId];
        if (!container) return;
        dispatch({
          type: 'reorderChildren',
          parentId: document.projectsNodeId,
          order: reorderKindWithinChildren(container.childIds, orderedIds),
        });
      }}
      moveTargets={(id) => {
        if (!document) return [];
        const excluded = subtreeIds(document, id); // can't move into itself or its own subtree
        const tops = projects(document).filter((p) => !excluded.has(p.id)); // siblings, listed first
        const topIds = new Set(tops.map((p) => p.id));
        const deeper = Object.values(document.nodes).filter(
          (n) => n.project && !excluded.has(n.id) && !topIds.has(n.id) && n.id !== document.projectsNodeId,
        );
        const toTarget = (n: NamNode) => ({
          id: n.id,
          label: [...projectPath(document, n.id), n.title].join(' › '),
        });
        return [...tops.map(toTarget), ...deeper.map(toTarget)];
      }}
      onMoveInto={(id, targetId) => {
        if (!document) return;
        dispatch({ type: 'moveNode', id, newParentId: targetId, now: nowIso() });
      }}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
    />
  );
}
