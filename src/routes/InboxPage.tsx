import { useMemo, useState } from 'react';
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
import { useCapture } from '@/capture/capture-context';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useSettings } from '@/components/settings/settings-context';
import { useAuthUser } from '@/auth/auth-context';

export function InboxPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { addToBottom } = useSettings();
  const { openCapture } = useCapture();
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

  function endDeck() {
    setQueue(null);
    setPos(0);
  }

  function advance() {
    if (!queue) return;
    if (pos + 1 >= queue.length) endDeck();
    else setPos((p) => p + 1);
  }

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
    if (inDeck) advance();
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
        onProcessAll={() => {
          setQueue(items.map((n) => n.id));
          setPos(0);
        }}
        onDelete={(id) => dispatch({ type: 'deleteLeaf', id })}
        onRename={(id, title) => {
          const node = document?.nodes[id];
          if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
        }}
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
          onCreateProject={(parentId, title) => {
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
          }}
          {...(inDeck
            ? {
                remaining: queue.length - pos,
                onDelete: () => {
                  dispatch({ type: 'deleteLeaf', id: current.id });
                  advance();
                },
                onSkip: advance,
              }
            : {})}
        />
      )}
    </>
  );
}
