import { blockedGroups } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { BlockedPanel, type BlockedRowGroup } from '@/features/blocked/BlockedPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useSetStatus } from '@/features/actions/useSetStatus';
import { useWorkspaceContext } from '@/store/workspace-context';

export function BlockedPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const setStatus = useSetStatus();

  const groups: BlockedRowGroup[] = document
    ? blockedGroups(document).map((g) => ({
        blocker: { id: g.blocker.id, title: g.blocker.title },
        rows: g.actions.map((n) => toActionRow(document, n)),
      }))
    : [];

  return (
    <BlockedPanel
      groups={groups}
      onOpenBlocker={openEditor}
      onSetStatus={setStatus}
      onEdit={openEditor}
      onDelete={deleteNode}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
    />
  );
}
