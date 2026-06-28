import { useState, type ReactNode } from 'react';
import { buildPath, projectActions, subProjects } from '@/domain/lenses';
import { captureDeletion } from '@/domain/mutations';
import { nowIso } from '@/lib/local';
import { useToast } from '@/components/ui/toast/toast-context';
import { useWorkspaceContext } from '@/store/workspace-context';
import { DeleteProjectContext } from './delete-project-context';
import { DeleteProjectDialog, type DeleteDisposition } from './DeleteProjectDialog';

function short(title: string): string {
  return title.length > 40 ? `${title.slice(0, 39)}…` : title;
}

/**
 * Owns the advanced project-delete dialog + the undoable delete. Exposes `requestDeleteProject(id)`.
 *
 * Execute composes existing intents (no new reducer code): snapshot the whole original subtree, move
 * the kept children up (actions → parent project / Free actions; sub-projects → parent / Top level),
 * then `deleteRecursive` the rest. **Undo** removes the moved-out children and restores the original
 * snapshot in place — so kept children return to the project, not duplicated.
 */
export function DeleteProjectProvider({ children }: { children: ReactNode }) {
  const { document, dispatch } = useWorkspaceContext();
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const project = pendingId && document ? document.nodes[pendingId] ?? null : null;
  const actions = project && document ? projectActions(document, project.id) : [];
  const subs = project && document ? subProjects(document, project.id) : [];
  // Parent project (immediate ancestor); none → the project is top-level.
  const ancestors = project && document ? buildPath(document, project.id) : [];
  const parentId = ancestors.length ? ancestors[ancestors.length - 1].id : null;

  const close = () => setPendingId(null);

  const execute = ({ keepActions, keepSubProjects }: DeleteDisposition) => {
    if (!document || !project) return;
    const id = project.id;
    const title = project.title;
    const now = nowIso();
    const capture = captureDeletion(document, id); // full original subtree, before any change
    const actionTarget = parentId ?? document.nextActionsNodeId; // top-level → Free actions
    const subTarget = parentId ?? document.projectsNodeId; // top-level → Top level

    const movedIds: string[] = [];
    if (keepActions) {
      for (const a of actions) {
        dispatch({ type: 'moveNode', id: a.id, newParentId: actionTarget, now });
        movedIds.push(a.id);
      }
    }
    if (keepSubProjects) {
      for (const s of subs) {
        dispatch({ type: 'moveNode', id: s.id, newParentId: subTarget, now });
        movedIds.push(s.id);
      }
    }
    // Delete the project and whatever wasn't moved out.
    dispatch({ type: 'deleteRecursive', id });
    close();

    if (capture) {
      toast({
        message: `Deleted “${short(title)}”`,
        actionLabel: 'Undo',
        onAction: () => {
          // Remove the moved-out children first (restore re-creates them in place — no duplicates).
          for (const movedId of movedIds) dispatch({ type: 'deleteRecursive', id: movedId });
          dispatch({ type: 'restoreNodes', capture });
        },
      });
    }
  };

  return (
    <DeleteProjectContext.Provider value={{ requestDeleteProject: setPendingId }}>
      {children}
      <DeleteProjectDialog
        project={project}
        isTopLevel={parentId === null}
        actionCount={actions.length}
        subCount={subs.length}
        onCancel={close}
        onConfirm={execute}
      />
    </DeleteProjectContext.Provider>
  );
}
