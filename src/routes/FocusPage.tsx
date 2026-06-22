import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { nowIso } from '@/lib/local';
import { useWorkspaceContext } from '@/store/workspace-context';
import { FocusDeck } from '@/features/focus/FocusDeck';
import { focusCards, type FocusSource } from '@/features/focus/focusCards';

/** Immersive full-screen execution surface (outside the shell chrome). */
export function FocusPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { document, dispatch } = useWorkspaceContext();

  // Scoped focus precedence: a project (?project=<id>), then a tag filter (?tags=home&next=1, from the
  // Tags view), else the global Next/Backlog toggle.
  const projectId = params.get('project');
  const tagsParam = params.get('tags');
  const nextOnly = params.get('next') === '1';
  const tags = useMemo(() => (tagsParam ? tagsParam.split(',').filter(Boolean) : []), [tagsParam]);
  const isTag = !projectId && tags.length > 0;
  const sourceParam = params.get('source');
  // Memoized so the object sources are stable across renders (keeps the cards useMemo honest).
  const source: FocusSource = useMemo(
    () =>
      projectId
        ? { project: projectId }
        : tags.length > 0
          ? { tags, nextOnly }
          : sourceParam === 'backlog'
            ? 'backlog'
            : 'next',
    [projectId, tags, nextOnly, sourceParam],
  );
  const sourceKey = projectId
    ? `project:${projectId}`
    : isTag
      ? `tags:${tagsParam}:${nextOnly}`
      : sourceParam === 'backlog'
        ? 'backlog'
        : 'next';
  const projectTitle = projectId && document ? document.nodes[projectId]?.title : undefined;
  const scopedLabel = projectId ? (projectTitle ?? 'project') : tags.join(', ');
  // Re-triage flip only makes sense for a single-status queue (flat Next/Backlog).
  const flat = !projectId && !isTag;

  const cards = useMemo(() => (document ? focusCards(document, source) : []), [document, source]);
  const exit = () =>
    navigate(projectId ? `/projects/${projectId}` : isTag ? '/tags' : sourceParam === 'backlog' ? '/backlog' : '/next');

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="Exit focus" onClick={exit}>
          <X />
        </Button>

        {projectId || isTag ? (
          <span className="truncate px-3 text-sm font-medium text-foreground">
            Focus: {scopedLabel}
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
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="w-10" aria-hidden />
      </div>

      <FocusDeck
        key={sourceKey}
        cards={cards}
        onDone={(id) => dispatch({ type: 'setStatus', id, status: 'DONE', now: nowIso() })}
        // In-flow re-triage for the flat queues: defer a Next to Backlog, or promote a Backlog to
        // Next. Omitted for project- and tag-scoped focus, whose decks mix statuses.
        flipLabel={flat ? (sourceParam === 'backlog' ? 'Next' : 'Backlog') : undefined}
        onFlip={
          flat
            ? (id) =>
                dispatch({
                  type: 'setStatus',
                  id,
                  status: sourceParam === 'backlog' ? 'NEXT' : 'BACKLOG',
                  now: nowIso(),
                })
            : undefined
        }
        onExit={exit}
      />
    </div>
  );
}
