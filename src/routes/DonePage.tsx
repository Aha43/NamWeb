import { doneItems } from '@/domain/lenses';
import { toActionRow } from '@/features/actions/rows';
import { DonePanel } from '@/features/done/DonePanel';
import { FocusButton } from '@/features/focus/FocusButton';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode, useDeleteNodes } from '@/features/actions/useDeleteNode';
import { useSetStatus, useSetStatuses } from '@/features/actions/useSetStatus';
import { useWorkspaceContext } from '@/store/workspace-context';

export function DonePage() {
  const { document } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const deleteNodes = useDeleteNodes();
  const setStatus = useSetStatus();
  const setStatuses = useSetStatuses();
  const rows = document ? doneItems(document).map((n) => toActionRow(document, n)) : [];
  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="flex justify-end">
          <FocusButton to="/focus?source=done" label="Focus Done — re-triage what wasn't really done" />
        </div>
      )}
      <DonePanel
        rows={rows}
        onRestore={(id) => setStatus(id, 'NEXT')}
        onBacklog={(id) => setStatus(id, 'BACKLOG')}
        onRestoreMany={(ids) => setStatuses(ids, 'NEXT')}
        onBacklogMany={(ids) => setStatuses(ids, 'BACKLOG')}
        onDelete={deleteNode}
        onDeleteMany={deleteNodes}
        onEdit={openEditor}
      />
    </div>
  );
}
