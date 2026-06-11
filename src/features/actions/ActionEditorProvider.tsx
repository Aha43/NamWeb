import { useMemo, useState, type ReactNode } from 'react';
import { ActionEditorContext } from './action-editor-context';
import { ActionDialog, type ActionEdits, type MoveTarget } from './ActionDialog';
import { useWorkspaceContext } from '@/store/workspace-context';
import { normalizeTags } from '@/domain/mutations';
import { projectPath, subtreeIds } from '@/domain/lenses';
import { nowIso } from '@/lib/local';

/** Same tag list (already normalized) — avoids dispatching a no-op tag update. */
function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}

/**
 * Provides `openEditor(id)` to the whole app and renders the (single) Action edit
 * dialog. Reads the live node from the workspace and dispatches only the intents
 * for fields that actually changed.
 */
export function ActionEditorProvider({ children }: { children: ReactNode }) {
  const { document, dispatch } = useWorkspaceContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const node = editingId && document ? document.nodes[editingId] ?? null : null;

  // Reparent targets: every project (any depth) outside the node's own subtree, plus Free actions.
  const moveTargets = useMemo<MoveTarget[]>(() => {
    if (!node || !document) return [];
    const excluded = subtreeIds(document, node.id);
    const targets: MoveTarget[] = [{ id: document.nextActionsNodeId, label: 'Free actions' }];
    for (const candidate of Object.values(document.nodes)) {
      if (!candidate.project || excluded.has(candidate.id)) continue;
      targets.push({ id: candidate.id, label: [...projectPath(document, candidate.id), candidate.title].join(' › ') });
    }
    return targets;
  }, [node, document]);

  function makeProject() {
    if (!node) return;
    dispatch({ type: 'convertActionToProject', id: node.id, now: nowIso() });
    setEditingId(null);
  }

  function move(targetId: string) {
    if (!node) return;
    dispatch({ type: 'moveNode', id: node.id, newParentId: targetId, now: nowIso() });
    setEditingId(null);
  }

  function save(edits: ActionEdits) {
    if (!node) return;
    const now = nowIso();
    if (edits.title !== node.title || edits.description !== node.description) {
      dispatch({ type: 'updateNode', id: node.id, title: edits.title, description: edits.description, now });
    }
    const tags = normalizeTags(edits.tags);
    if (!sameTags(tags, node.tags)) {
      dispatch({ type: 'updateTags', id: node.id, tags, now });
    }
    if (edits.dueAt !== node.dueAt) {
      dispatch({ type: 'setDue', id: node.id, dueAt: edits.dueAt, now });
    }
    if (edits.status !== node.status) {
      dispatch({ type: 'setStatus', id: node.id, status: edits.status, now });
    }
  }

  return (
    <ActionEditorContext.Provider value={{ openEditor: (id) => setEditingId(id) }}>
      {children}
      {node && (
        <ActionDialog
          key={node.id}
          node={node}
          open
          onOpenChange={(open) => {
            if (!open) setEditingId(null);
          }}
          onSave={save}
          onMakeProject={node.project ? undefined : makeProject}
          moveTargets={moveTargets}
          onMove={move}
        />
      )}
    </ActionEditorContext.Provider>
  );
}
