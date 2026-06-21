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

  // Project-scoped focus (?project=<id>) takes precedence over the Next/Backlog toggle.
  const projectId = params.get('project');
  const sourceParam = params.get('source');
  // Memoized so the project-source object is stable across renders (keeps the cards useMemo honest).
  const source: FocusSource = useMemo(
    () => (projectId ? { project: projectId } : sourceParam === 'backlog' ? 'backlog' : 'next'),
    [projectId, sourceParam],
  );
  const sourceKey = projectId ? `project:${projectId}` : sourceParam === 'backlog' ? 'backlog' : 'next';
  const projectTitle = projectId && document ? document.nodes[projectId]?.title : undefined;

  const cards = useMemo(() => (document ? focusCards(document, source) : []), [document, source]);
  const exit = () =>
    navigate(projectId ? `/projects/${projectId}` : source === 'backlog' ? '/backlog' : '/next');

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="Exit focus" onClick={exit}>
          <X />
        </Button>

        {projectId ? (
          <span className="truncate px-3 text-sm font-medium text-foreground">
            Focus: {projectTitle ?? 'project'}
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
        // Next. Omitted for project-scoped focus, whose deck mixes statuses.
        flipLabel={projectId ? undefined : source === 'backlog' ? 'Next' : 'Backlog'}
        onFlip={
          projectId
            ? undefined
            : (id) =>
                dispatch({
                  type: 'setStatus',
                  id,
                  status: source === 'backlog' ? 'NEXT' : 'BACKLOG',
                  now: nowIso(),
                })
        }
        onExit={exit}
      />
    </div>
  );
}
