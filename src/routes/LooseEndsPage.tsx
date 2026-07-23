import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { ActionRow } from '@/features/actions/ActionRow';
import { DueHintLabel } from '@/features/actions/DueHintLabel';
import { toActionRow } from '@/features/actions/rows';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { goneQuiet, isNotStalled, stalledProjects } from '@/domain/review';
import { blockedGroups, dueGroups, inboxItems } from '@/domain/lenses';
import { NOT_STALLED_TAG, canonicalTag } from '@/domain/systemTags';
import { effectiveDue } from '@/domain/derivedDue';
import { useWorkspaceContext } from '@/store/workspace-context';
import { nowIso } from '@/lib/local';
import { cn } from '@/lib/utils';
import type { NamNode } from '@/domain/types';

/**
 * "Loose ends" (#906) — the always-on status overview (GTD *Reflect*, sans jargon or cadence).
 * Composes the deterministic "mess" lenses (stalled projects · gone quiet) with drill-in, plus
 * reference counts for Inbox / Overdue / Blocked. A window you glance at whenever, never a chore:
 * no streaks, no score, no "you haven't reviewed". Projects can be marked `#not-stalled` (#909) when
 * they're intentionally next-less; those are hidden by default, revealable to review the set.
 */
export function LooseEndsPage() {
  const { t } = useTranslation();
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  if (!document) return null;

  const showAcknowledged = params.get('acknowledged') === '1';
  // Compute the full next-less set once, then split by the acknowledgement tag.
  const stalledAll = stalledProjects(document, true);
  const acknowledgedCount = stalledAll.filter(isNotStalled).length;
  const stalled = showAcknowledged ? stalledAll : stalledAll.filter((p) => !isNotStalled(p));

  const quiet = goneQuiet(document);
  const quietRows = quiet.map((n) => toActionRow(document, n));

  const refs = [
    { to: '/inbox', label: t('domain.inbox'), count: inboxItems(document).length },
    { to: '/due', label: t('review.overdue'), count: dueGroups(document).overdue.length },
    { to: '/blocked', label: t('domain.blocked'), count: blockedGroups(document).reduce((n, g) => n + g.actions.length, 0) },
  ];

  const allClear = stalled.length === 0 && quiet.length === 0;

  function toggleAcknowledged() {
    const next = new URLSearchParams(params);
    if (showAcknowledged) next.delete('acknowledged');
    else next.set('acknowledged', '1');
    setParams(next);
  }

  function toggleNotStalled(p: NamNode) {
    const on = isNotStalled(p);
    dispatch({
      type: 'updateTags',
      id: p.id,
      tags: on ? p.tags.filter((tag) => canonicalTag(tag) !== NOT_STALLED_TAG) : [...p.tags, NOT_STALLED_TAG],
      now: nowIso(),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('domain.looseEnds')}</h2>
          {/* Only offered when there's a set to review — no dead control otherwise. */}
          {acknowledgedCount > 0 && (
            <Tooltip label={t('review.showAcknowledged')}>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('review.showAcknowledged')}
                aria-pressed={showAcknowledged}
                className={cn('gap-1.5', showAcknowledged && 'bg-accent text-accent-foreground')}
                onClick={toggleAcknowledged}
              >
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">{t('review.showAcknowledged')}</span>
              </Button>
            </Tooltip>
          )}
        </div>
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
                {stalled.map((p) => {
                  const acknowledged = isNotStalled(p);
                  return (
                    <li key={p.id} className="flex items-center gap-1 pr-2 transition-colors hover:bg-accent">
                      <button
                        type="button"
                        aria-label={t('column.openAria', { title: p.title })}
                        onClick={() => navigate(`/projects/${p.id}`)}
                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                      >
                        <Folder className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                        <TruncatedTitle text={p.title} className="min-w-0 flex-1 text-sm text-foreground" />
                        {acknowledged && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {t('review.acknowledged')}
                          </span>
                        )}
                        <DueHintLabel {...effectiveDue(document, p.id)} />
                      </button>
                      {/* One-click "this is fine" — tags the project #not-stalled (drops it off the
                          default list). While reviewing acknowledged, the same control un-marks. */}
                      <Tooltip label={acknowledged ? t('review.notStalledUndo') : t('review.markNotStalled')}>
                        <button
                          type="button"
                          aria-label={acknowledged ? t('review.notStalledUndoAria', { title: p.title }) : t('review.markNotStalledAria', { title: p.title })}
                          aria-pressed={acknowledged}
                          onClick={() => toggleNotStalled(p)}
                          className={cn(
                            'shrink-0 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                            acknowledged
                              ? 'border-transparent bg-accent text-accent-foreground'
                              : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          {t('review.notStalled')}
                        </button>
                      </Tooltip>
                    </li>
                  );
                })}
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
