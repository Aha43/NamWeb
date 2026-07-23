import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Folder } from 'lucide-react';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { ActionRow } from '@/features/actions/ActionRow';
import { DueHintLabel } from '@/features/actions/DueHintLabel';
import { toActionRow } from '@/features/actions/rows';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { goneQuiet, stalledProjects } from '@/domain/review';
import { blockedGroups, dueGroups, inboxItems } from '@/domain/lenses';
import { effectiveDue } from '@/domain/derivedDue';
import { useWorkspaceContext } from '@/store/workspace-context';

/**
 * "Loose ends" (#906) — the always-on status overview (the GTD *Reflect* surface, sans jargon or
 * cadence). Composes the deterministic "mess" lenses (stalled projects · gone quiet) with drill-in,
 * plus reference counts for Inbox / Overdue / Blocked that link to their own homes. A window you
 * glance at whenever, never a chore: no streaks, no score, no "you haven't reviewed".
 */
export function LooseEndsPage() {
  const { t } = useTranslation();
  const { document } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const navigate = useNavigate();

  if (!document) return null;

  const stalled = stalledProjects(document);
  const quiet = goneQuiet(document);
  const quietRows = quiet.map((n) => toActionRow(document, n));

  const refs = [
    { to: '/inbox', label: t('domain.inbox'), count: inboxItems(document).length },
    { to: '/due', label: t('review.overdue'), count: dueGroups(document).overdue.length },
    { to: '/blocked', label: t('domain.blocked'), count: blockedGroups(document).reduce((n, g) => n + g.actions.length, 0) },
  ];

  const allClear = stalled.length === 0 && quiet.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{t('domain.looseEnds')}</h2>
        {/* Reference counts — the other places worth a glance, each opening its own surface. Dimmed
            at zero so a clear inbox/board reads as calm, not a call to action. */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {refs.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className={r.count > 0 ? 'text-foreground hover:underline' : 'text-muted-foreground hover:underline'}
            >
              {r.label} <span className="font-semibold tabular-nums">{r.count}</span>
            </Link>
          ))}
        </div>
      </div>

      {allClear ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{t('review.allClear')}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{t('review.allClearHint')}</p>
        </div>
      ) : (
        <>
          {stalled.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('review.stalledProjects')} · {stalled.length}
              </h3>
              <p className="px-1 text-xs text-muted-foreground">{t('review.stalledHint')}</p>
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {stalled.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-label={t('column.openAria', { title: p.title })}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <Folder className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                      <TruncatedTitle text={p.title} className="min-w-0 flex-1 text-sm text-foreground" />
                      <DueHintLabel {...effectiveDue(document, p.id)} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {quietRows.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('review.goneQuiet')} · {quietRows.length}
              </h3>
              <p className="px-1 text-xs text-muted-foreground">{t('review.goneQuietHint')}</p>
              <ul className="flex flex-col gap-1">
                {quietRows.map((row) => (
                  <ActionRow
                    key={row.id}
                    row={row}
                    actions={null}
                    onEdit={() => openEditor(row.id)}
                    onDelete={() => deleteNode(row.id)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
