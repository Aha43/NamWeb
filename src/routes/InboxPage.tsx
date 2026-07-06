import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { archivedProjectIds, inboxItems, projectPath, structuralNodeIds, subtreeIds } from '@/domain/lenses';
import { buildLearnNam } from '@/domain/learnNam';
import { newId, nowIso } from '@/lib/local';
import { InboxPanel } from '@/features/inbox/InboxPanel';
import {
  InboxProcessDialog,
  type ProcessResolution,
  type ProjectTarget,
} from '@/features/inbox/InboxProcessDialog';
import { GetStarted } from '@/features/onboarding/GetStarted';
import { useGetStartedDismissed } from '@/features/onboarding/useGetStartedDismissed';
import { useDeleteNode, useDeleteNodes } from '@/features/actions/useDeleteNode';
import { useCapture } from '@/capture/capture-context';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useSettings } from '@/components/settings/settings-context';
import { useAuthUser } from '@/auth/auth-context';

export function InboxPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { addToBottom } = useSettings();
  const { openCapture } = useCapture();
  const deleteNode = useDeleteNode();
  const deleteNodes = useDeleteNodes();
  const navigate = useNavigate();
  const user = useAuthUser();
  const [getStartedDismissed, dismissGetStarted] = useGetStartedDismissed(user.id);
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Process-all deck: a snapshot of ids to walk one-by-one, plus the current position.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [pos, setPos] = useState(0);

  const items = document ? inboxItems(document) : [];

  // "Essentially empty" = nothing but the four structural containers → show the get-started on-ramp.
  const emptyWorkspace =
    !!document &&
    Object.values(document.nodes).filter((n) => !structuralNodeIds(document).has(n.id)).length === 0;
  const showGetStarted = emptyWorkspace && !getStartedDismissed;

  const addLearnNam = () => {
    if (!document) return;
    const seed = buildLearnNam(newId, new Date());
    dispatch({ type: 'seedProject', parentId: document.projectsNodeId, nodes: [seed], now: nowIso() });
    navigate(`/projects/${seed.id}`);
  };

  // Create a project (under `parentId`, or top level) and return its id — powers the pickers' "New
  // project here". Shared by the bulk "File under" picker and the per-item Process dialog.
  const createProject = (parentId: string | null, title: string): string => {
    if (!document) return '';
    const id = newId();
    dispatch({
      type: 'addSubProject',
      parentId: parentId ?? document.projectsNodeId,
      id,
      title,
      atTop: !addToBottom,
      now: nowIso(),
    });
    return id;
  };

  const inDeck = queue !== null;
  const deckId = queue ? queue[pos] : undefined;
  const current = deckId
    ? items.find((n) => n.id === deckId) ?? null
    : processingId
      ? items.find((n) => n.id === processingId) ?? null
      : null;

  // Existing projects the clarified item can be filed/nested under (any depth, excluding its own subtree).
  const projectTargets = useMemo<ProjectTarget[]>(() => {
    if (!document || !current) return [];
    const excluded = subtreeIds(document, current.id);
    const archived = archivedProjectIds(document);
    const targets: ProjectTarget[] = [];
    for (const candidate of Object.values(document.nodes)) {
      if (!candidate.project || excluded.has(candidate.id) || archived.has(candidate.id)) continue;
      targets.push({ id: candidate.id, label: [...projectPath(document, candidate.id), candidate.title].join(' › ') });
    }
    return targets;
  }, [document, current]);

  // All non-archived projects, for the bulk "File under" picker (inbox items have no own subtree to exclude).
  const bulkProjectTargets = useMemo<ProjectTarget[]>(() => {
    if (!document) return [];
    const archived = archivedProjectIds(document);
    const targets: ProjectTarget[] = [];
    for (const candidate of Object.values(document.nodes)) {
      if (!candidate.project || archived.has(candidate.id)) continue;
      targets.push({ id: candidate.id, label: [...projectPath(document, candidate.id), candidate.title].join(' › ') });
    }
    return targets;
  }, [document]);

  // Apply one shared resolution to every selected inbox item (#458) — loops the same intents as
  // single Process (no deck, no per-item undo, matching single Process).
  function bulkResolve(ids: string[], resolution: ProcessResolution) {
    const now = nowIso();
    for (const id of ids) {
      if (resolution.kind === 'project') {
        dispatch({ type: 'convertInboxToProject', id, parentId: resolution.parentId, now });
      } else {
        dispatch({ type: 'convertInboxToAction', id, status: resolution.status, parentId: resolution.parentId, now });
      }
    }
  }

  function endDeck() {
    setQueue(null);
    setPos(0);
  }

  // The deck cycles (#648): resolving/deleting removes the current id from the remaining set —
  // the deck ends only when that set is empty (or the dialog is closed). Skip just moves on,
  // wrapping past the end so skipped items come around again.
  function dropFromQueue(id: string) {
    if (!queue) return;
    const next = queue.filter((qid) => qid !== id);
    if (next.length === 0) endDeck();
    else {
      setQueue(next);
      if (pos >= next.length) setPos(0);
    }
  }

  function skip() {
    if (!queue || queue.length === 0) return;
    setPos((p) => (p + 1) % queue.length);
  }

  // If the current deck item vanishes underneath us (deleted or processed on another surface),
  // drop it from the queue rather than leaving the deck stranded on a missing card.
  useEffect(() => {
    if (!queue || !deckId) return;
    if (items.some((n) => n.id === deckId)) return;
    dropFromQueue(deckId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, queue, deckId]);

  function resolve(resolution: ProcessResolution) {
    if (!current) return;
    const now = nowIso();
    if (resolution.kind === 'project') {
      dispatch({ type: 'convertInboxToProject', id: current.id, parentId: resolution.parentId, now });
    } else {
      dispatch({
        type: 'convertInboxToAction',
        id: current.id,
        status: resolution.status,
        parentId: resolution.parentId,
        now,
      });
    }
    if (inDeck) dropFromQueue(current.id);
    else setProcessingId(null);
  }

  return (
    <>
      {showGetStarted && (
        <GetStarted onCapture={openCapture} onAddLearnNam={addLearnNam} onDismiss={dismissGetStarted} />
      )}
      <InboxPanel
        items={items}
        onAdd={(title) => dispatch({ type: 'addInboxItem', id: newId(), title, atTop: !addToBottom, now: nowIso() })}
        onProcess={setProcessingId}
        onProcessAll={(ids) => {
          // Over the selection when given (#648), else the whole inbox.
          setQueue(ids && ids.length > 0 ? ids : items.map((n) => n.id));
          setPos(0);
        }}
        onDelete={(id) => deleteNode(id)}
        onRename={(id, title) => {
          const node = document?.nodes[id];
          if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
        }}
        onBulkResolve={bulkResolve}
        onBulkDelete={(ids) => deleteNodes(ids)}
        projectTargets={bulkProjectTargets}
        onCreateProject={createProject}
      />
      {current && (
        <InboxProcessDialog
          key={current.id}
          node={current}
          open
          onOpenChange={(open) => {
            if (!open) {
              setProcessingId(null);
              endDeck();
            }
          }}
          onResolve={resolve}
          projectTargets={projectTargets}
          onCreateProject={createProject}
          {...(inDeck
            ? {
                remaining: queue.length,
                onDelete: () => {
                  dispatch({ type: 'deleteLeaf', id: current.id });
                  dropFromQueue(current.id);
                },
                onSkip: skip,
              }
            : {})}
        />
      )}
    </>
  );
}
