import { useNavigate } from 'react-router-dom';
import { projects } from '@/domain/lenses';
import { buildLearnNam } from '@/domain/learnNam';
import { newId, nowIso } from '@/lib/local';
import { ProjectsPanel } from '@/features/projects/ProjectsPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function ProjectsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
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
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
    />
  );
}
