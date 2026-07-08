import { actionMoveTargets, actionMoveTargetsAll, applyViewOrder, backlogItems } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { sortNodes } from '@/features/actions/sort';
import { useSortMode } from '@/features/actions/useSortMode';
import { BacklogPanel } from '@/features/backlog/BacklogPanel';
import { FocusButton } from '@/features/focus/FocusButton';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useSetStatus } from '@/features/actions/useSetStatus';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { useSettings } from '@/components/settings/settings-context';
import { useWorkspaceContext } from '@/store/workspace-context';

const VIEW = 'backlog';

export function BacklogPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { addToBottom } = useSettings();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const setStatus = useSetStatus();
  const [sortMode, cycleSort] = useSortMode(VIEW);
  const isDesktop = useIsDesktop();

  // In "Unsorted" mode the saved manual order applies; oldest/newest are computed.
  const base = document ? backlogItems(document) : [];
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
      <BacklogPanel
      rows={document ? ordered.map((n) => toActionRow(document, n)) : []}
      focusSlot={ordered.length > 0 ? <FocusButton to="/focus?source=backlog" label="Focus your Backlog" /> : undefined}
      sortMode={sortMode}
      onCycleSort={cycleSort}
      reorderable={sortMode === 'none'}
      onMove={move}
      onReorder={(ids) => dispatch({ type: 'reorderView', view: VIEW, order: ids })}
      dndEnabled={isDesktop}
      onAdd={
        document
          ? (title) => {
              const id = newId();
              dispatch({
                type: 'addAction',
                parentId: document.nextActionsNodeId,
                id,
                title,
                status: 'BACKLOG',
                atTop: !addToBottom,
                now: nowIso(),
              });
              // Place it in this view's saved order — top by default, bottom when preferred.
              const existing = ordered.map((n) => n.id);
              dispatch({ type: 'reorderView', view: VIEW, order: addToBottom ? [...existing, id] : [id, ...existing] });
            }
          : undefined
      }
      onDelete={deleteNode}
      moveTargets={document ? (id) => actionMoveTargets(document, id) : undefined}
      moveBrowseTargets={document ? (id) => actionMoveTargetsAll(document, id) : undefined}
      onMoveInto={(id, targetId) => dispatch({ type: 'moveNode', id, newParentId: targetId, now: nowIso() })}
      onCreateProject={
        document
          ? (parentId, title) => {
              const newProjectId = newId();
              dispatch({
                type: 'addSubProject',
                parentId: parentId ?? document.projectsNodeId,
                id: newProjectId,
                title,
                atTop: !addToBottom,
                now: nowIso(),
              });
              return newProjectId;
            }
          : undefined
      }
      onSetStatus={setStatus}
      onEdit={openEditor}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
      />
    </div>
  );
}
