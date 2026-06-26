import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectMoveTargets, projectQuickMoveTargets, projects, reorderKindWithinChildren, subtreeIds } from '@/domain/lenses';
import { buildLearnNam } from '@/domain/learnNam';
import { importSeedFromJson } from '@/domain/importWorkspace';
import { newId, nowIso } from '@/lib/local';
import { ProjectsPanel } from '@/features/projects/ProjectsPanel';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { useSettings } from '@/components/settings/settings-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function ProjectsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { addToBottom } = useSettings();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const deleteNode = useDeleteNode();
  const [showArchived, setShowArchived] = useState(false);

  // Count-aware delete confirm: warn how many items go with a non-empty project.
  const deleteMessage = (id: string) => {
    const node = document?.nodes[id];
    if (!node) return 'Delete this project? This cannot be undone.';
    const descendants = document ? subtreeIds(document, id).size - 1 : 0;
    return descendants > 0
      ? `Delete the "${node.title}" project and its ${descendants} item${descendants === 1 ? '' : 's'}? This cannot be undone.`
      : `Delete the "${node.title}" project? This cannot be undone.`;
  };

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
      onDelete={(id) => deleteNode(id)}
      deleteMessage={deleteMessage}
      onAdd={(title) => {
        if (!document) return;
        dispatch({ type: 'addSubProject', parentId: document.projectsNodeId, id: newId(), title, atTop: !addToBottom, now: nowIso() });
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
      quickMoveTargets={(id) => (document ? projectQuickMoveTargets(document, id) : [])}
      onMoveInto={(id, targetId) => {
        if (!document) return;
        dispatch({ type: 'moveNode', id, newParentId: targetId, now: nowIso() });
      }}
      onCreateProject={(parentId, title) => {
        if (!document) return '';
        const id = newId();
        dispatch({
          type: 'addSubProject',
          parentId: parentId ?? document.projectsNodeId,
          id,
          title,
          atTop: !addToBottom,
          now: nowIso(),
        });
        return id;
      }}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
    />
  );
}
