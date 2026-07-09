import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Folder, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { calendarMonth, dayActions, dayProjects, isValidLocalDate, localDateString } from '@/domain/calendar';
import { MonthGrid } from '@/features/calendar/MonthGrid';
import { ActionRow } from '@/features/actions/ActionRow';
import { DueHintLabel } from '@/features/actions/DueHintLabel';
import { toActionRow } from '@/features/actions/rows';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useWorkspaceContext } from '@/store/workspace-context';
import { newId, nowIso } from '@/lib/local';

/**
 * The global calendar (#675) — a thin shell around interchangeable calendar *views*: header with
 * «‹›» month/year navigation + Today, then the view. The classic month grid is the first view;
 * the `view` URL param is reserved for future ones (a list view, an inner view toolbar) so they
 * can slot in without reshaping this page. The shown month lives in `?m=YYYY-MM`, so browser
 * back/forward and bookmarks behave.
 */
export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const now = new Date();
  // Validate beyond shape — `?m=2026-99` / `?d=2026-99-99` otherwise reach date math and
  // formatters as Invalid Dates (which throw); garbage falls back to today's month / the grid (#696).
  const m = /^(\d{4})-(\d{2})$/.exec(params.get('m') ?? '');
  const requested = m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? { year: Number(m[1]), month: Number(m[2]) } : null;
  const year = requested ? requested.year : now.getFullYear();
  const month = requested ? requested.month : now.getMonth() + 1; // 1-12
  const monthParam = `${year}-${String(month).padStart(2, '0')}`;
  // Drill-in day (#676): with ?d= the grid swaps for that day's action list; browser back and the
  // explicit back button both return to the same month.
  const dParam = params.get('d');
  const day = dParam && isValidLocalDate(dParam) ? dParam : null;

  function show(y: number, mo: number) {
    // Normalize (month 0 → Dec of prev year, 13 → Jan of next).
    const d = new Date(y, mo - 1, 1);
    setParams({ m: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  }

  if (!document) return null;

  if (day) {
    const rows = dayActions(document, day).map((n) => toActionRow(document, n));
    const projects = dayProjects(document, day);
    const dayTitle = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' }).format(
      new Date(`${day}T00:00:00`),
    );
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setParams({ m: monthParam })}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('calendar.backToCalendar')}
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold capitalize">{dayTitle}</h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              // Create-for-this-day (#681): born with the listed date (noon), then the normal
              // editor for everything else. Cancelling leaves a visible, deletable placeholder.
              const id = newId();
              dispatch({
                type: 'addAction',
                parentId: document.nextActionsNodeId,
                id,
                title: t('calendar.newActionTitle'),
                status: 'NEXT',
                dueAt: day,
                dueTime: '12:00',
                now: nowIso(),
              });
              openEditor(id);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('calendar.newAction')}
          </Button>
        </div>
        {rows.length === 0 && projects.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">{t('calendar.emptyDay')}</p>
        ) : (
          <>
            {rows.length > 0 && (
              <ul className="flex flex-col gap-1">
                {rows.map((row) => (
                  <ActionRow
                    key={row.id}
                    row={row}
                    actions={null}
                    onEdit={() => openEditor(row.id)}
                    onDelete={() => deleteNode(row.id)}
                  />
                ))}
              </ul>
            )}
            {/* The day's projects (#703) — context/milestones under the workable actions; each
                opens its workbench. Deliberately no create-project here. */}
            {projects.length > 0 && (
              <div className="space-y-1">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('domain.projects')}
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        aria-label={t('column.openAria', { title: p.title })}
                        onClick={() => navigate(`/projects/${p.id}`)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
                      >
                        <Folder className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                        <TruncatedTitle text={p.title} className="min-w-0 flex-1 text-sm text-foreground" />
                        <DueHintLabel dueAt={p.dueAt} dueEndAt={p.dueEndAt} dueTime={p.dueTime} dueEndTime={p.dueEndTime} />
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
  const days = calendarMonth(document, year, month, now);
  const title = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold capitalize">{title}</h2>
        <div className="flex items-center gap-0.5">
          <Tooltip label={t('calendar.prevYear')}>
            <Button variant="ghost" size="sm" aria-label={t('calendar.prevYear')} onClick={() => show(year - 1, month)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip label={t('calendar.prevMonth')}>
            <Button variant="ghost" size="sm" aria-label={t('calendar.prevMonth')} onClick={() => show(year, month - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Button variant="outline" size="sm" disabled={isCurrentMonth} onClick={() => setParams({})}>
            {t('calendar.today')}
          </Button>
          <Tooltip label={t('calendar.nextMonth')}>
            <Button variant="ghost" size="sm" aria-label={t('calendar.nextMonth')} onClick={() => show(year, month + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip label={t('calendar.nextYear')}>
            <Button variant="ghost" size="sm" aria-label={t('calendar.nextYear')} onClick={() => show(year + 1, month)}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <MonthGrid days={days} today={localDateString(now)} onSelectDay={(date) => setParams({ m: monthParam, d: date })} />
    </div>
  );
}
