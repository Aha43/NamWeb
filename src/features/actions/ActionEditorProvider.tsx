import { useMemo, useState, type ReactNode } from 'react';
import { ActionEditorContext } from './action-editor-context';
import { ActionDialog, type ActionEdits, type MoveTarget } from './ActionDialog';
import { useWorkspaceContext } from '@/store/workspace-context';
import { normalizeTags } from '@/domain/mutations';
import { allTags, archivedProjectIds, canAddPrerequisite, effectiveTags, projectPath, structuralNodeIds, subtreeIds, unblocks } from '@/domain/lenses';
import { useDeleteNode } from './useDeleteNode';
import { newId, nowIso } from '@/lib/local';

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
    const archived = archivedProjectIds(document);
    const targets: MoveTarget[] = [{ id: document.nextActionsNodeId, label: 'Free actions' }];
    for (const candidate of Object.values(document.nodes)) {
      if (!candidate.project || excluded.has(candidate.id) || archived.has(candidate.id)) continue;
      targets.push({ id: candidate.id, label: [...projectPath(document, candidate.id), candidate.title].join(' › ') });
    }
    return targets;
  }, [node, document]);

  // Tags inherited from ancestor projects ("rub-off") — shown read-only in the dialog.
  const inheritedTags = useMemo<string[]>(() => {
    if (!node || !document) return [];
    return effectiveTags(document, node.id).filter((t) => !node.tags.includes(t));
  }, [node, document]);

  // Blocked-by data, recomputed live as prerequisites are added/removed.
  const blockers = useMemo(() => {
    if (!node || !document) return [];
    return node.blockedBy
      .map((id) => document.nodes[id])
      .filter(Boolean)
      .map((b) => ({ id: b.id, title: b.title, done: b.status === 'DONE' }));
  }, [node, document]);

  const blockerCandidates = useMemo<MoveTarget[]>(() => {
    if (!node || !document) return [];
    const structural = structuralNodeIds(document);
    const targets: MoveTarget[] = [];
    for (const candidate of Object.values(document.nodes)) {
      if (candidate.project || structural.has(candidate.id)) continue;
      if (!canAddPrerequisite(document, node.id, candidate.id)) continue;
      targets.push({ id: candidate.id, label: candidate.title });
    }
    return targets;
  }, [node, document]);

  const wouldUnblock = useMemo(() => {
    if (!node || !document) return [];
    return unblocks(document, node.id).map((n) => n.title);
  }, [node, document]);

  function makeProject() {
    if (!node) return;
    dispatch({ type: 'convertActionToProject', id: node.id, now: nowIso() });
    setEditingId(null);
  }

  // Count-aware confirm message for the dialog's inline delete confirm.
  const deleteMessage = useMemo(() => {
    if (!node || !document) return undefined;
    const descendants = subtreeIds(document, node.id).size - 1;
    const label = node.project ? 'project' : 'action';
    return descendants > 0
      ? `Delete the "${node.title}" ${label} and its ${descendants} item${descendants === 1 ? '' : 's'}? This cannot be undone.`
      : `Delete the "${node.title}" ${label}? This cannot be undone.`;
  }, [node, document]);

  const deleteNode = useDeleteNode();
  function remove() {
    if (!node) return;
    deleteNode(node.id);
    setEditingId(null);
  }

  function addPrerequisite(prereqId: string) {
    if (!node) return;
    dispatch({ type: 'addPrerequisite', actionId: node.id, prereqId, now: nowIso() });
  }

  function removePrerequisite(prereqId: string) {
    if (!node) return;
    dispatch({ type: 'removePrerequisite', actionId: node.id, prereqId, now: nowIso() });
  }

  function move(targetId: string) {
    if (!node) return;
    dispatch({ type: 'moveNode', id: node.id, newParentId: targetId, now: nowIso() });
    setEditingId(null);
  }

  // Create a project under `parentId` (null = top level) and return its id — for the picker's
  // "New project here", which then moves the node into it.
  function createProject(parentId: string | null, title: string): string {
    if (!document) return '';
    const id = newId();
    dispatch({
      type: 'addSubProject',
      parentId: parentId ?? document.projectsNodeId,
      id,
      title,
      atTop: true,
      now: nowIso(),
    });
    return id;
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
    if (JSON.stringify(edits.resources) !== JSON.stringify(node.resources)) {
      dispatch({ type: 'updateResources', id: node.id, resources: edits.resources, now });
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
          availableTags={document ? allTags(document) : []}
          inheritedTags={inheritedTags}
          onMakeProject={node.project ? undefined : makeProject}
          moveTargets={moveTargets}
          onMove={move}
          onCreateProject={createProject}
          blockers={blockers}
          blockerCandidates={blockerCandidates}
          wouldUnblock={wouldUnblock}
          onAddPrerequisite={node.project ? undefined : addPrerequisite}
          onRemovePrerequisite={node.project ? undefined : removePrerequisite}
          onDelete={remove}
          deleteConfirmMessage={deleteMessage}
        />
      )}
    </ActionEditorContext.Provider>
  );
}
