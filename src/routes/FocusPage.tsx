import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { nowIso } from '@/lib/local';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useSetStatus } from '@/features/actions/useSetStatus';
import { FocusDeck } from '@/features/focus/FocusDeck';
import { focusCards, type FocusSource } from '@/features/focus/focusCards';
import { tagFilterParams } from '@/features/tags/tagFilterParams';

/** Immersive full-screen execution surface (outside the shell chrome). */
export function FocusPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const setStatus = useSetStatus();

  // Scoped focus precedence: a project (?project=<id>), then a tag filter (?tags=home&next=1, from the
  // Tags view), else the global Next/Backlog toggle.
  const projectId = params.get('project');
  const tagsParam = params.get('tags');
  const nextOnly = params.get('next') === '1';
  const tags = useMemo(() => (tagsParam ? tagsParam.split(',').filter(Boolean) : []), [tagsParam]);
  const isTag = !projectId && tags.length > 0;
  const sourceParam = params.get('source');
  const isDue = !projectId && !isTag && sourceParam === 'due';
  const isDone = !projectId && !isTag && sourceParam === 'done';
  // Memoized so the object sources are stable across renders (keeps the cards useMemo honest).
  const source: FocusSource = useMemo(
    () =>
      projectId
        ? { project: projectId }
        : tags.length > 0
          ? { tags, nextOnly }
          : sourceParam === 'backlog'
            ? 'backlog'
            : sourceParam === 'due'
              ? 'due'
              : sourceParam === 'done'
                ? 'done'
                : 'next',
    [projectId, tags, nextOnly, sourceParam],
  );
  const sourceKey = projectId
    ? `project:${projectId}`
    : isTag
      ? `tags:${tagsParam}:${nextOnly}`
      : sourceParam === 'backlog'
        ? 'backlog'
        : sourceParam === 'due'
          ? 'due'
          : sourceParam === 'done'
            ? 'done'
            : 'next';
  const projectTitle = projectId && document ? document.nodes[projectId]?.title : undefined;
  const scopedLabel = projectId
    ? (projectTitle ?? t('focus.scopeProject'))
    : isDue
      ? t('focus.scopeDue')
      : isDone
        ? t('focus.scopeDone')
        : tags.join(', ');
  // A scoped deck (project / tags / due / done) mixes statuses, so no flat Next↔Backlog re-triage flip.
  const flat = !projectId && !isTag && !isDue && !isDone;

  const cards = useMemo(() => (document ? focusCards(document, source) : []), [document, source]);
  const exit = () => {
    if (projectId) navigate(`/projects/${projectId}`);
    // Return to Tags with the same selection/Next-only that launched Focus, not a bare /tags —
    // and if a bookmark id rode along, land back in its view, not the workshop (#750/F2).
    else if (isTag) {
      const search = tagFilterParams(tags, nextOnly);
      const bm = params.get('bm');
      if (bm) search.set('bm', bm);
      navigate({ pathname: '/tags', search: search.toString() });
    }
    else if (isDue) navigate('/due');
    else if (isDone) navigate('/done');
    else navigate(sourceParam === 'backlog' ? '/backlog' : '/next');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" aria-label={t('focus.exit')} onClick={exit}>
          <X />
        </Button>

        {projectId || isTag || isDue || isDone ? (
          <span className="truncate px-3 text-sm font-medium text-foreground">
            {t('focus.scopedTitle', { label: scopedLabel })}
          </span>
        ) : (
          <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
            {(['next', 'backlog'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setParams({ source: s })}
                className={cn(
                  'rounded px-3 py-1 text-sm font-medium capitalize transition-colors',
                  source === s ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground',
                )}
              >
                {t(`domain.status.${s}`)}
              </button>
            ))}
          </div>
        )}

        <div className="w-10" aria-hidden />
      </div>

      <FocusDeck
        key={sourceKey}
        cards={cards}
        // Done-focus is re-triage: the primary action restores the card to Next (it wasn't done after
        // all); otherwise the deck marks the card Done.
        onDone={(id) => setStatus(id, isDone ? 'NEXT' : 'DONE')}
        doneLabel={isDone ? t('focus.toNext') : undefined}
        // In-flow re-triage: flat queues flip Next↔Backlog; Done-focus moves the card to Backlog.
        flipLabel={
          flat
            ? sourceParam === 'backlog'
              ? t('domain.status.next')
              : t('domain.status.backlog')
            : isDone
              ? t('domain.status.backlog')
              : undefined
        }
        onFlip={
          flat
            ? (id) => setStatus(id, sourceParam === 'backlog' ? 'NEXT' : 'BACKLOG')
            : isDone
              ? (id) => setStatus(id, 'BACKLOG')
              : undefined
        }
        onExit={exit}
        onEditCard={(id) => openEditor(id)}
        onRenameCard={(id, title) => {
          const node = document?.nodes[id];
          if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
        }}
        onDeleteCard={(id) => deleteNode(id)}
      />
    </div>
  );
}
