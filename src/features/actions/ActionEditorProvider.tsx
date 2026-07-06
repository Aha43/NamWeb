import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActionEditorContext } from './action-editor-context';
import { ActionDialog, type ActionEdits, type MoveTarget } from './ActionDialog';
import { useWorkspaceContext } from '@/store/workspace-context';
import { normalizeTags } from '@/domain/mutations';
import { allTags, archivedProjectIds, canAddPrerequisite, effectiveTags, projectPath, structuralNodeIds, subtreeIds, unblocks } from '@/domain/lenses';
import { useDeleteNode } from './useDeleteNode';
import { useDeleteProject } from '@/features/projects/delete/delete-project-context';
import { newId, nowIso } from '@/lib/local';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/toast/toast-context';
import { makeActionLink, parseActionLink } from '@/domain/actionLinks';

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
  const { t } = useTranslation();
  const { toast } = useToast();
  const { document, dispatch } = useWorkspaceContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Fire-time state for the link-back toast (#663): the toast can fire up to 6s after save, so its
  // action must re-read the *current* document/editing state, never the ones captured at save.
  const docRef = useRef(document);
  docRef.current = document;
  const editingIdRef = useRef<string | null>(null);
  editingIdRef.current = editingId;
  // The open ActionDialog registers a buffer-inserter here: a link-back aimed at the node being
  // edited must land in that dialog's buffered resources — a direct dispatch would be silently
  // clobbered when the dialog saves its mount-seeded buffer (#663).
  const bufferLinkRef = useRef<((targetId: string) => void) | null>(null);
  const node = editingId && document ? document.nodes[editingId] ?? null : null;

  // If the edited node vanishes under the open dialog (deleted on another surface, sync pull),
  // the dialog unmounts without onOpenChange(false) — drop the id too, or a later restore of the
  // same id (undo, conflict replay) would silently pop the dialog back open (#614).
  useEffect(() => {
    if (editingId && document && !document.nodes[editingId]) setEditingId(null);
  }, [editingId, document]);

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
  const { requestDeleteProject } = useDeleteProject();
  function remove() {
    if (!node) return;
    // Projects go through the advanced-delete dialog (content disposition); actions delete directly.
    if (node.project) requestDeleteProject(node.id);
    else deleteNode(node.id);
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
    if (
      edits.dueAt !== node.dueAt ||
      (edits.dueEndAt ?? null) !== (node.dueEndAt ?? null) ||
      (edits.dueTime ?? null) !== (node.dueTime ?? null) ||
      (edits.dueEndTime ?? null) !== (node.dueEndTime ?? null)
    ) {
      dispatch({
        type: 'setDue',
        id: node.id,
        dueAt: edits.dueAt,
        dueEndAt: edits.dueEndAt ?? null,
        dueTime: edits.dueTime ?? null,
        dueEndTime: edits.dueEndTime ?? null,
        now,
      });
    }
    if (edits.status !== node.status) {
      dispatch({ type: 'setStatus', id: node.id, status: edits.status, now });
    }
    if (JSON.stringify(edits.resources) !== JSON.stringify(node.resources)) {
      dispatch({ type: 'updateResources', id: node.id, resources: edits.resources, now });
      // Double-link offer (#659): a link was just created from this card — offer the reverse.
      // The target isn't buffered anywhere (this dialog is closing), so the link-back commits
      // directly. Offered for the last link added in this save.
      const before = new Set(node.resources.map(parseActionLink).filter(Boolean));
      const added = edits.resources
        .map(parseActionLink)
        .filter((id): id is string => id !== null && !before.has(id));
      const targetId = added[added.length - 1];
      const target = targetId ? document?.nodes[targetId] : undefined;
      if (target && !target.resources.some((r) => parseActionLink(r) === node.id)) {
        const sourceId = node.id; // capture ids only — everything else re-read at fire time (#663)
        toast({
          message: t('editor.linkedTo', { title: target.title }),
          actionLabel: t('editor.linkBack'),
          onAction: () => {
            const fresh = docRef.current?.nodes[target.id];
            if (!fresh) return; // target deleted since the save
            if (fresh.resources.some((r) => parseActionLink(r) === sourceId)) return; // linked meanwhile
            if (editingIdRef.current === target.id && bufferLinkRef.current) {
              bufferLinkRef.current(sourceId); // its editor is open — go via the buffer
              return;
            }
            dispatch({
              type: 'updateResources',
              id: target.id,
              resources: [...fresh.resources, makeActionLink(sourceId)],
              now: nowIso(),
            });
          },
        });
      }
    }
  }

  return (
    <ActionEditorContext.Provider value={{ openEditor: (id) => setEditingId(id) }}>
      {children}
      {node && (
        <ActionDialog
          key={node.id}
          node={node}
          linkBackRef={bufferLinkRef}
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
