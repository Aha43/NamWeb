import { applyViewOrder, nextActions } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { sortNodes } from '@/features/actions/sort';
import { useSortMode } from '@/features/actions/useSortMode';
import { NextActionsPanel } from '@/features/next-actions/NextActionsPanel';
import { FocusButton } from '@/features/focus/FocusButton';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { useWorkspaceContext } from '@/store/workspace-context';

const VIEW = 'next';

export function NextActionsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const [sortMode, cycleSort] = useSortMode(VIEW);
  const isDesktop = useIsDesktop();

  // In "Unsorted" mode the saved manual order applies; oldest/newest are computed.
  const base = document ? nextActions(document) : [];
  const ordered =
    sortMode === 'none' ? applyViewOrder(base, document?.viewOrders[VIEW]) : sortNodes(base, sortMode);

  function move(id: string, direction: 'up' | 'down') {
    const ids = ordered.map((n) => n.id);
    const i = ids.indexOf(id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    dispatch({ type: 'reorderView', view: VIEW, order: ids });
  }

  return (
    <div className="space-y-3">
      {ordered.length > 0 && (
        <div className="flex justify-end">
          <FocusButton to="/focus" label="Focus your Next actions" />
        </div>
      )}
      <NextActionsPanel
      rows={document ? ordered.map((n) => toActionRow(document, n)) : []}
      onAdd={
        document
          ? (title) => {
              const id = newId();
              dispatch({
                type: 'addAction',
                parentId: document.nextActionsNodeId,
                id,
                title,
                status: 'NEXT',
                now: nowIso(),
              });
              // Land it first in this view's order (the flat lens otherwise puts new items last).
              dispatch({ type: 'reorderView', view: VIEW, order: [id, ...ordered.map((n) => n.id)] });
            }
          : undefined
      }
      onDelete={deleteNode}
      sortMode={sortMode}
      onCycleSort={cycleSort}
      reorderable={sortMode === 'none'}
      onMove={move}
      onReorder={(ids) => dispatch({ type: 'reorderView', view: VIEW, order: ids })}
      dndEnabled={isDesktop}
      onSetStatus={(id, status) => dispatch({ type: 'setStatus', id, status, now: nowIso() })}
      onEdit={openEditor}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
      />
    </div>
  );
}
