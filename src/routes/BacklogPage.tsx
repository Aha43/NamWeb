import { backlogItems } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { sortNodes } from '@/features/actions/sort';
import { useSortMode } from '@/features/actions/useSortMode';
import { BacklogPanel } from '@/features/backlog/BacklogPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function BacklogPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const [sortMode, cycleSort] = useSortMode('backlog');
  return (
    <BacklogPanel
      rows={document ? sortNodes(backlogItems(document), sortMode).map((n) => toActionRow(document, n)) : []}
      sortMode={sortMode}
      onCycleSort={cycleSort}
      onPromote={(id) => dispatch({ type: 'setStatus', id, status: 'NEXT', now: nowIso() })}
      onEdit={openEditor}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
    />
  );
}
