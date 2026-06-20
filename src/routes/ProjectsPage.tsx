import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectMoveTargets, projects, reorderKindWithinChildren } from '@/domain/lenses';
import { buildLearnNam } from '@/domain/learnNam';
import { importSeedFromJson } from '@/domain/importWorkspace';
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
  const [showArchived, setShowArchived] = useState(false);

  const allProjects = document ? projects(document) : [];
  const archivedCount = allProjects.filter((p) => p.status === 'ARCHIVED').length;
  const visibleProjects = showArchived ? allProjects : allProjects.filter((p) => p.status !== 'ARCHIVED');

  return (
    <ProjectsPanel
      projects={visibleProjects}
      showArchived={showArchived}
      onToggleShowArchived={() => setShowArchived((v) => !v)}
      archivedCount={archivedCount}
      onArchive={(id) => dispatch({ type: 'setStatus', id, status: 'ARCHIVED', now: nowIso() })}
      onUnarchive={(id) => dispatch({ type: 'setStatus', id, status: 'BACKLOG', now: nowIso() })}
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
      onImportWorkspace={(json) => {
        if (!document) return { ok: false, error: 'Workspace not ready.' };
        const result = importSeedFromJson(json, newId, new Date());
        if (!result.ok) return result;
        dispatch({ type: 'seedProject', parentId: document.projectsNodeId, nodes: [result.seed], now: nowIso() });
        navigate(`/projects/${result.seed.id}`);
        return { ok: true };
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
      moveTargets={(id) => (document ? projectMoveTargets(document, id) : [])}
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
