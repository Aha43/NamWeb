import { nextActions } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { NextActionsPanel } from '@/features/next-actions/NextActionsPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function NextActionsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  return (
    <NextActionsPanel
      rows={document ? nextActions(document).map((n) => toActionRow(document, n)) : []}
      onMarkDone={(id) => dispatch({ type: 'setStatus', id, status: 'DONE', now: nowIso() })}
      onMarkBacklog={(id) => dispatch({ type: 'setStatus', id, status: 'BACKLOG', now: nowIso() })}
      onEdit={openEditor}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
    />
  );
}
