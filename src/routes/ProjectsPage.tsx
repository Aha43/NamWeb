import { useNavigate } from 'react-router-dom';
import { projects } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import { ProjectsPanel } from '@/features/projects/ProjectsPanel';
import { useWorkspaceContext } from '@/store/workspace-context';

export function ProjectsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const navigate = useNavigate();
  return (
    <ProjectsPanel
      projects={document ? projects(document) : []}
      onAdd={(title) => {
        if (!document) return;
        dispatch({ type: 'addSubProject', parentId: document.projectsNodeId, id: newId(), title, now: nowIso() });
      }}
      onOpen={(id) => navigate(`/projects/${id}`)}
    />
  );
}
