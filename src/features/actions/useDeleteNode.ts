import { subtreeIds } from '@/domain/lenses';
import { useWorkspaceContext } from '@/store/workspace-context';

/**
 * Confirm-and-delete a node (leaf or whole subtree) — shared by the action editor's
 * Delete and the inline row trash. Confirms via the count-aware message (mirrors the
 * editor's existing dialog) and returns whether the delete actually happened.
 */
export function useDeleteNode(): (id: string) => boolean {
  const { document, dispatch } = useWorkspaceContext();
  return (id: string) => {
    if (!document) return false;
    const node = document.nodes[id];
    if (!node) return false;
    const descendants = subtreeIds(document, id).size - 1;
    const label = node.project ? 'project' : 'action';
    const message =
      descendants > 0
        ? `Delete the "${node.title}" ${label} and its ${descendants} item${descendants === 1 ? '' : 's'}?`
        : `Delete the "${node.title}" ${label}?`;
    if (!window.confirm(message)) return false;
    dispatch(descendants > 0 ? { type: 'deleteRecursive', id } : { type: 'deleteLeaf', id });
    return true;
  };
}
