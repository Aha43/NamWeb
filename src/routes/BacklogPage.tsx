import { backlogItems } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { BacklogPanel } from '@/features/backlog/BacklogPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function BacklogPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  return (
    <BacklogPanel
      rows={document ? backlogItems(document).map((n) => toActionRow(document, n)) : []}
      onPromote={(id) => dispatch({ type: 'setStatus', id, status: 'NEXT', now: nowIso() })}
      onEdit={openEditor}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
    />
  );
}
