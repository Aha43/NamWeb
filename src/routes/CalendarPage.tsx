import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutGrid, List, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { agenda, calendarMonth, dayActions, dayProjects, isValidLocalDate, localDateString } from '@/domain/calendar';
import { effectiveDue } from '@/domain/derivedDue';
import { MonthGrid } from '@/features/calendar/MonthGrid';
import { AgendaView } from '@/features/calendar/AgendaView';
import { CalendarProjectRow } from '@/features/calendar/CalendarProjectRow';
import { ActionRow } from '@/features/actions/ActionRow';
import { StatusMenu } from '@/features/actions/StatusMenu';
import { StatusFilterBoxes } from '@/features/actions/StatusFilterBoxes';
import { checkedStatuses, useStatusBoxes } from '@/features/actions/statusBoxes';
import { toActionRow } from '@/features/actions/rows';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useSetStatus } from '@/features/actions/useSetStatus';
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
  const setStatus = useSetStatus();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // The agenda (list) view filters by the usual Next/Backlog/Done status boxes (#995 tweak) — the
  // grid keeps its big "Show done" toggle. Default open work (Next + Backlog); session-local.
  const [agendaBoxes, toggleAgendaBox] = useStatusBoxes({ NEXT: true, BACKLOG: true });

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
  // "Show done" (#868): opt-in via ?done=1, so it's off by default and survives back/forward and
  // bookmarks like the month/day params. Preserved across month/day navigation below.
  const includeDone = params.get('done') === '1';
  // Which view (#995): the classic month grid (default) or the agenda list. `?view=list`.
  const view = params.get('view') === 'list' ? 'list' : 'grid';

  function show(y: number, mo: number) {
    // Normalize (month 0 → Dec of prev year, 13 → Jan of next).
    const d = new Date(y, mo - 1, 1);
    const next: Record<string, string> = { m: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
    if (includeDone) next.done = '1';
    setParams(next);
  }

  function toggleDone() {
    const next = new URLSearchParams(params);
    if (includeDone) next.delete('done');
    else next.set('done', '1');
    setParams(next);
  }

  const doneToggle = (
    <Tooltip label={t('calendar.showDone')}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('calendar.showDone')}
        aria-pressed={includeDone}
        className={cn('gap-1.5', includeDone && 'bg-accent text-accent-foreground')}
        onClick={toggleDone}
      >
        <CheckCircle2 className="h-4 w-4" />
        <span className="hidden sm:inline">{t('calendar.showDone')}</span>
      </Button>
    </Tooltip>
  );

  // Grid ⇄ list toggle (#995). Switching to list drops the month/day params (an agenda is
  // continuous, not month-bound); switching to grid keeps the shown month. Show-done rides along.
  function setView(v: 'grid' | 'list') {
    const next = new URLSearchParams();
    if (v === 'list') {
      // The agenda filters via its own status boxes, not ?done — keep the URL clean.
      next.set('view', 'list');
    } else {
      if (params.get('m')) next.set('m', params.get('m')!);
      if (includeDone) next.set('done', '1');
    }
    setParams(next);
  }
  const viewToggle = (
    <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
      {(['grid', 'list'] as const).map((v) => {
        const label = t(v === 'grid' ? 'calendar.viewGrid' : 'calendar.viewList');
        const Icon = v === 'grid' ? LayoutGrid : List;
        return (
          <button
            key={v}
            type="button"
            aria-label={label}
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(
              'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
              view === v ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );

  if (!document) return null;

  if (view === 'list') {
    const ag = agenda(document, now, checkedStatuses(agendaBoxes));
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{t('calendar.agendaTitle')}</h2>
            <StatusFilterBoxes boxes={agendaBoxes} onToggle={toggleAgendaBox} />
          </div>
          {viewToggle}
        </div>
        <AgendaView
          document={document}
          agenda={ag}
          today={localDateString(now)}
          onEdit={openEditor}
          onSetStatus={setStatus}
          onRename={(id, title) => {
            const n = document.nodes[id];
            if (n) dispatch({ type: 'updateNode', id, title, description: n.description, now: nowIso() });
          }}
          onDelete={deleteNode}
          onOpenProject={(id) => navigate(`/projects/${id}`)}
        />
      </div>
    );
  }

  if (day) {
    const rows = dayActions(document, day, includeDone).map((n) => toActionRow(document, n));
    const projects = dayProjects(document, day, includeDone);
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
            onClick={() => setParams(includeDone ? { m: monthParam, done: '1' } : { m: monthParam })}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('calendar.backToCalendar')}
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold capitalize">{dayTitle}</h2>
          {doneToggle}
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
                    // Status + rename here (#895); move stays out — reparenting doesn't fit a
                    // date-scoped list. Delete/in-progress/copy come built into the row.
                    actions={
                      <StatusMenu
                        status={row.status}
                        title={row.title}
                        onSetStatus={(status) => setStatus(row.id, status)}
                      />
                    }
                    onEdit={() => openEditor(row.id)}
                    onRename={(title) => {
                      const n = document.nodes[row.id];
                      if (n) dispatch({ type: 'updateNode', id: row.id, title, description: n.description, now: nowIso() });
                    }}
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
                <ul className="flex flex-col gap-1">
                  {projects.map((p) => (
                    <CalendarProjectRow
                      key={p.id}
                      title={p.title}
                      due={effectiveDue(document, p.id)}
                      onOpen={() => navigate(`/projects/${p.id}`)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
  const days = calendarMonth(document, year, month, now, includeDone);
  const title = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-lg font-semibold capitalize">{title}</h2>
          {doneToggle}
          {viewToggle}
        </div>
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
          <Button
            variant="outline"
            size="sm"
            disabled={isCurrentMonth}
            onClick={() => setParams(includeDone ? { done: '1' } : {})}
          >
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
      <MonthGrid
        days={days}
        today={localDateString(now)}
        onSelectDay={(date) =>
          setParams(includeDone ? { m: monthParam, d: date, done: '1' } : { m: monthParam, d: date })
        }
      />
    </div>
  );
}
