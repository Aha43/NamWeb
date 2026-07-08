import { dueGroups } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { DuePanel, type DueRowGroups } from '@/features/due/DuePanel';
import { FocusButton } from '@/features/focus/FocusButton';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useSetStatus } from '@/features/actions/useSetStatus';
import { useWorkspaceContext } from '@/store/workspace-context';

const EMPTY: DueRowGroups = { overdue: [], today: [], thisWeek: [], later: [] };

export function DuePage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const setStatus = useSetStatus();

  let groups = EMPTY;
  if (document) {
    const g = dueGroups(document);
    const rows = (ns: typeof g.overdue) => ns.map((n) => toActionRow(document, n));
    groups = { overdue: rows(g.overdue), today: rows(g.today), thisWeek: rows(g.thisWeek), later: rows(g.later) };
  }

  // The `due` Focus source is the due-now set (overdue + today); offer Focus only when it's non-empty.
  const hasDueNow = groups.overdue.length > 0 || groups.today.length > 0;

  return (
    <div className="space-y-3">
      <DuePanel
      groups={groups}
      focusSlot={hasDueNow ? <FocusButton to="/focus?source=due" label="Focus what's due now" /> : undefined}
      onSetStatus={setStatus}
      onEdit={openEditor}
      onDelete={deleteNode}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
      />
    </div>
  );
}
