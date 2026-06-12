import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { buildPath } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { ProjectWorkbench } from '@/features/projects/ProjectWorkbench';
import { missionStats } from '@/features/projects/missionStats';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function ProjectWorkbenchPage() {
  const { id = '' } = useParams();
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const navigate = useNavigate();

  if (!document) return null;
  const project = document.nodes[id];
  if (!project || !project.project) return <Navigate to="/projects" replace />;

  const children = project.childIds.map((cid) => document.nodes[cid]).filter(Boolean);
  const actions = children.filter((n) => !n.project).map((n) => toActionRow(document, n));
  const subProjects = children.filter((n) => n.project);

  return (
    <ProjectWorkbench
      project={project}
      breadcrumb={buildPath(document, id)}
      actions={actions}
      subProjects={subProjects}
      subProjectStats={subProjects.length > 0 ? missionStats(document, id) : undefined}
      onOpenProject={(pid) => navigate(`/projects/${pid}`)}
      onOpenProjects={() => navigate('/projects')}
      onAddAction={(title) =>
        dispatch({ type: 'addAction', parentId: id, id: newId(), title, status: 'NEXT', now: nowIso() })
      }
      onAddSubProject={(title) =>
        dispatch({ type: 'addSubProject', parentId: id, id: newId(), title, now: nowIso() })
      }
      onSetStatus={(actionId, status) => dispatch({ type: 'setStatus', id: actionId, status, now: nowIso() })}
      onEdit={openEditor}
      onRename={(actionId, title) => {
        const node = document.nodes[actionId];
        if (node) dispatch({ type: 'updateNode', id: actionId, title, description: node.description, now: nowIso() });
      }}
      onConvertToAction={
        project.childIds.length === 0
          ? () => dispatch({ type: 'convertProjectToAction', id, status: 'NEXT', now: nowIso() })
          : undefined
      }
      onSaveAsTemplate={() => {
        const name = window.prompt('Template name', project.title)?.trim();
        if (name) dispatch({ type: 'saveAsTemplate', name, nodeId: id });
      }}
    />
  );
}
