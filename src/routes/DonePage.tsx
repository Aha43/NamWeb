import { doneItems } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { DonePanel } from '@/features/done/DonePanel';
import { FocusButton } from '@/features/focus/FocusButton';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useWorkspaceContext } from '@/store/workspace-context';

export function DonePage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
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
        onRestore={(id) => dispatch({ type: 'setStatus', id, status: 'NEXT', now: nowIso() })}
        onBacklog={(id) => dispatch({ type: 'setStatus', id, status: 'BACKLOG', now: nowIso() })}
        onDelete={deleteNode}
        onEdit={openEditor}
      />
    </div>
  );
}
