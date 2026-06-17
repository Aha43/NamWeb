import { dueGroups } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { DuePanel, type DueRowGroups } from '@/features/due/DuePanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useWorkspaceContext } from '@/store/workspace-context';

const EMPTY: DueRowGroups = { overdue: [], today: [], thisWeek: [], later: [] };

export function DuePage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();

  let groups = EMPTY;
  if (document) {
    const g = dueGroups(document);
    const rows = (ns: typeof g.overdue) => ns.map((n) => toActionRow(document, n));
    groups = { overdue: rows(g.overdue), today: rows(g.today), thisWeek: rows(g.thisWeek), later: rows(g.later) };
  }

  return (
    <DuePanel
      groups={groups}
      onSetStatus={(id, status) => dispatch({ type: 'setStatus', id, status, now: nowIso() })}
      onEdit={openEditor}
      onDelete={deleteNode}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
    />
  );
}
