import { useNavigate } from 'react-router-dom';
import { newId, nowIso } from '@/lib/local';
import { cloneTemplateNodes } from '@/domain/mutations';
import { TemplatesPanel } from '@/features/templates/TemplatesPanel';
import { useWorkspaceContext } from '@/store/workspace-context';

export function TemplatesPage() {
  const { document, dispatch } = useWorkspaceContext();
  const navigate = useNavigate();
  return (
    <TemplatesPanel
      templates={document?.templates ?? []}
      onDelete={(name) => dispatch({ type: 'deleteTemplate', name })}
      onUse={(name) => {
        if (!document) return;
        const template = document.templates.find((t) => t.name === name);
        if (!template) return;
        // Create a NEW top-level project named after the template, filled with its (rich) structure —
        // one atomic seedProject wrapping the cloned template as the new project's children (#864).
        const projectId = newId();
        dispatch({
          type: 'seedProject',
          parentId: document.projectsNodeId,
          nodes: [{ id: projectId, title: name, project: true, children: cloneTemplateNodes(template.children, newId) }],
          atTop: true, // land it first in the Projects list so it's found without scrolling (#864)
          now: nowIso(),
        });
        navigate(`/projects/${projectId}`);
      }}
    />
  );
}
