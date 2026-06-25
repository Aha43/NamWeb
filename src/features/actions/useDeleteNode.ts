import { subtreeIds } from '@/domain/lenses';
import { captureDeletion, type DeletionCapture, type Intent } from '@/domain/mutations';
import { useToast } from '@/components/ui/toast/toast-context';
import { useWorkspaceContext } from '@/store/workspace-context';
import type { WorkspaceDocument } from '@/domain/types';

/** Trim a title for a toast message. */
function short(title: string): string {
  return title.length > 40 ? `${title.slice(0, 39)}…` : title;
}

/** The right delete intent for a node — leaf vs whole subtree. */
function deleteIntent(doc: WorkspaceDocument, id: string): Intent {
  return subtreeIds(doc, id).size - 1 > 0 ? { type: 'deleteRecursive', id } : { type: 'deleteLeaf', id };
}

/**
 * Delete a node — a leaf or a whole subtree — and surface an **Undo** toast that restores it (and
 * its descendants, and any external blocked-by links) to its original place. **No confirmation
 * here** — callers confirm first; Undo is the safety net for the moment after.
 */
export function useDeleteNode(): (id: string) => void {
  const { document, dispatch } = useWorkspaceContext();
  const { toast } = useToast();
  return (id: string) => {
    if (!document || !document.nodes[id]) return;
    const capture = captureDeletion(document, id);
    const title = document.nodes[id].title;
    dispatch(deleteIntent(document, id));
    if (capture) {
      toast({
        message: `Deleted "${short(title)}"`,
        actionLabel: 'Undo',
        onAction: () => dispatch({ type: 'restoreNodes', capture }),
      });
    }
  };
}

/**
 * Delete several nodes at once with a single **Undo** toast that restores them all. Used by bulk
 * operations (e.g. clearing selected items in Done).
 */
export function useDeleteNodes(): (ids: string[]) => void {
  const { document, dispatch } = useWorkspaceContext();
  const { toast } = useToast();
  return (ids: string[]) => {
    if (!document) return;
    const captures: DeletionCapture[] = [];
    for (const id of ids) {
      if (!document.nodes[id]) continue;
      const capture = captureDeletion(document, id);
      if (capture) captures.push(capture);
      dispatch(deleteIntent(document, id));
    }
    if (captures.length === 0) return;
    toast({
      message:
        captures.length === 1
          ? `Deleted "${short(captures[0].nodes[0].title)}"`
          : `Deleted ${captures.length} items`,
      actionLabel: 'Undo',
      onAction: () => {
        for (const capture of captures) dispatch({ type: 'restoreNodes', capture });
      },
    });
  };
}
