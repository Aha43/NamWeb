import { doneItems } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { DonePanel } from '@/features/done/DonePanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useWorkspaceContext } from '@/store/workspace-context';

export function DonePage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  return (
    <DonePanel
      rows={document ? doneItems(document).map((n) => toActionRow(document, n)) : []}
      onRestore={(id) => dispatch({ type: 'setStatus', id, status: 'NEXT', now: nowIso() })}
      onBacklog={(id) => dispatch({ type: 'setStatus', id, status: 'BACKLOG', now: nowIso() })}
      onDelete={deleteNode}
      onEdit={openEditor}
    />
  );
}
