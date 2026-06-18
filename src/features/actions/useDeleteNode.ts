import { subtreeIds } from '@/domain/lenses';
import { useWorkspaceContext } from '@/store/workspace-context';

/**
 * Delete a node — a leaf (`deleteLeaf`) or a whole subtree (`deleteRecursive`), chosen by
 * whether it has descendants. **No confirmation here** — callers confirm first (the inline row
 * trash uses an anchored `ConfirmButton`; the editor uses its own dialog).
 */
export function useDeleteNode(): (id: string) => void {
  const { document, dispatch } = useWorkspaceContext();
  return (id: string) => {
    if (!document) return;
    if (!document.nodes[id]) return;
    const descendants = subtreeIds(document, id).size - 1;
    dispatch(descendants > 0 ? { type: 'deleteRecursive', id } : { type: 'deleteLeaf', id });
  };
}
