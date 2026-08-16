import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Folder, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { ProjectPathLinks } from '@/features/actions/ProjectPathLinks';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useSetStatus } from '@/features/actions/useSetStatus';
import { buildPath, somedayRoots } from '@/domain/lenses';
import { useWorkspaceContext } from '@/store/workspace-context';

/**
 * The Someday view (#1131) — the one in-app place parked "not decided to do" items appear (they're
 * deliberately absent from Next / Backlog / Loose ends / context). Lists the *outermost* someday
 * nodes (`somedayRoots` — a whole parked subtree is one row). Promotion out (→ Next / → Backlog) is
 * the happy path; deletion is a **success**, so it's one low-friction click (the standard undo toast
 * is the safety net — no heavy confirm).
 */
export function SomedayPage() {
  const { t } = useTranslation();
  const { document } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const setStatus = useSetStatus();
  const navigate = useNavigate();

  if (!document) return null;
  const roots = somedayRoots(document);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('someday.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('someday.subtitle')}</p>
      </div>

      {roots.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{t('someday.empty')}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{t('someday.emptyHint')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {roots.map((n) => {
            const path = buildPath(document, n.id).map((a) => ({ id: a.id, title: a.title }));
            return (
              <li key={n.id} className="flex items-center gap-1 px-3 py-2 transition-colors hover:bg-accent">
                {n.project && <Folder className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />}
                <div className="min-w-0 flex-1">
                  <ProjectPathLinks path={path} className="truncate text-xs text-muted-foreground" />
                  <button
                    type="button"
                    aria-label={n.project ? t('column.openAria', { title: n.title }) : t('actions.editAria', { title: n.title })}
                    onClick={() => (n.project ? navigate(`/projects/${n.id}`) : openEditor(n.id))}
                    className="block w-full text-left"
                  >
                    <TruncatedTitle text={n.title} className="min-w-0 flex-1 text-sm text-foreground" />
                  </button>
                </div>
                {/* Promote out of someday — the happy path (deciding to do it). Direct to Next, or park
                    in Backlog to sequence it. */}
                <Tooltip label={t('someday.promoteNext', { title: n.title })}>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t('someday.promoteNext', { title: n.title })}
                    onClick={() => setStatus(n.id, 'NEXT')}
                  >
                    {t('domain.status.next')}
                  </Button>
                </Tooltip>
                <Tooltip label={t('someday.promoteBacklog', { title: n.title })}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    aria-label={t('someday.promoteBacklog', { title: n.title })}
                    onClick={() => setStatus(n.id, 'BACKLOG')}
                  >
                    {t('domain.status.backlog')}
                  </Button>
                </Tooltip>
                {/* Low-friction delete — emptying a someday list is a success (#1131). Undo toast covers it. */}
                <Tooltip label={t('actions.deleteAria', { title: n.title })}>
                  <button
                    type="button"
                    aria-label={t('actions.deleteAria', { title: n.title })}
                    onClick={() => deleteNode(n.id)}
                    className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
