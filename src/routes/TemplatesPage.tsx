import { TemplatesPanel } from '@/features/templates/TemplatesPanel';
import { useWorkspaceContext } from '@/store/workspace-context';

export function TemplatesPage() {
  const { document, dispatch } = useWorkspaceContext();
  return (
    <TemplatesPanel
      templates={document?.templates ?? []}
      onDelete={(name) => dispatch({ type: 'deleteTemplate', name })}
    />
  );
}
