import { nextActions } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { sortNodes } from '@/features/actions/sort';
import { useSortMode } from '@/features/actions/useSortMode';
import { NextActionsPanel } from '@/features/next-actions/NextActionsPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function NextActionsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const [sortMode, cycleSort] = useSortMode('next');
  return (
    <NextActionsPanel
      rows={document ? sortNodes(nextActions(document), sortMode).map((n) => toActionRow(document, n)) : []}
      sortMode={sortMode}
      onCycleSort={cycleSort}
      onSetStatus={(id, status) => dispatch({ type: 'setStatus', id, status, now: nowIso() })}
      onEdit={openEditor}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
    />
  );
}
