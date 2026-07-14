import { dueGroups } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { DuePanel, type DueRowGroups } from '@/features/due/DuePanel';
import { FocusButton } from '@/features/focus/FocusButton';
import { StatusFilterBoxes } from '@/features/actions/StatusFilterBoxes';
import { useStatusBoxes } from '@/features/actions/statusBoxes';
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

  // Status include-boxes (#766): due's natural set is open work (Next + Backlog); ticking
  // Done shows what was due AND got done — the satisfying view.
  const [boxes, toggleBox, boxesDefault] = useStatusBoxes({ NEXT: true, BACKLOG: true });
  let groups = EMPTY;
  if (document) {
    const g = dueGroups(document, new Date(), boxes.DONE);
    const keep = (n: (typeof g.overdue)[number]) =>
      n.status === 'NEXT' || n.status === 'BACKLOG' || n.status === 'DONE' ? boxes[n.status as 'NEXT' | 'BACKLOG' | 'DONE'] : true;
    const rows = (ns: typeof g.overdue) => ns.filter(keep).map((n) => toActionRow(document, n));
    groups = { overdue: rows(g.overdue), today: rows(g.today), thisWeek: rows(g.thisWeek), later: rows(g.later) };
  }

  // The `due` Focus source is the due-now set (overdue + today); offer Focus only when it's non-empty.
  const hasDueNow = groups.overdue.length > 0 || groups.today.length > 0;

  return (
    <div className="space-y-3">
      <DuePanel
      groups={groups}
      focusSlot={hasDueNow ? <FocusButton to="/focus?source=due" label="Focus what's due now" /> : undefined}
      statusSlot={<StatusFilterBoxes boxes={boxes} onToggle={toggleBox} />}
      boxesDefault={boxesDefault}
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
