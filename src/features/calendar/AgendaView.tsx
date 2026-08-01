import { useTranslation } from 'react-i18next';
import { ActionRow } from '@/features/actions/ActionRow';
import { StatusMenu } from '@/features/actions/StatusMenu';
import { toActionRow } from '@/features/actions/rows';
import { effectiveDue } from '@/domain/derivedDue';
import { CalendarProjectRow } from './CalendarProjectRow';
import type { Agenda, AgendaDay } from '@/domain/calendar';
import type { NodeStatus, WorkspaceDocument } from '@/domain/types';

/**
 * The agenda (list) calendar view (#995): a continuous scroll of dated projects + actions, month
 * titles as dividers (Google-Calendar-mobile style), no empty days and no add affordances — for
 * scanning what's coming up. Open past-due items surface in an Overdue group at the top; today
 * onward is grouped by month. Acting-in-place is kept (status menu / open / rename / delete on
 * actions; a project row opens its workbench) — creating happens back in the classic grid.
 */
export function AgendaView({
  document,
  agenda,
  today,
  onEdit,
  onSetStatus,
  onRename,
  onDelete,
  onOpenProject,
}: {
  document: WorkspaceDocument;
  agenda: Agenda;
  today: string;
  onEdit: (id: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onOpenProject: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();

  const dayLabel = (date: string, withMonth: boolean) =>
    new Intl.DateTimeFormat(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      ...(withMonth ? { month: 'short' } : {}),
    }).format(new Date(`${date}T00:00:00`));

  const monthLabel = (date: string) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`));

  const dayGroup = (day: AgendaDay, withMonth: boolean) => (
    <div key={day.date} className="space-y-1">
      <h4 className="px-1 text-xs font-medium capitalize text-muted-foreground">
        {day.date === today ? t('calendar.agendaToday', { day: dayLabel(day.date, withMonth) }) : dayLabel(day.date, withMonth)}
      </h4>
      <ul className="flex flex-col gap-1">
        {day.entries.map((e) =>
          e.kind === 'action' ? (
            <ActionRow
              key={e.node.id}
              row={toActionRow(document, e.node)}
              actions={
                <StatusMenu
                  status={e.node.status}
                  title={e.node.title}
                  onSetStatus={(status) => onSetStatus(e.node.id, status)}
                />
              }
              onEdit={() => onEdit(e.node.id)}
              onRename={(title) => onRename(e.node.id, title)}
              onDelete={() => onDelete(e.node.id)}
            />
          ) : (
            <CalendarProjectRow
              key={e.node.id}
              title={e.node.title}
              due={effectiveDue(document, e.node.id)}
              onOpen={() => onOpenProject(e.node.id)}
            />
          ),
        )}
      </ul>
    </div>
  );

  if (agenda.overdue.length === 0 && agenda.upcoming.length === 0 && agenda.past.length === 0) {
    return <p className="px-1 py-8 text-center text-sm text-muted-foreground">{t('calendar.agendaEmpty')}</p>;
  }

  return (
    <div className="space-y-5">
      {agenda.overdue.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-red-600 dark:text-red-400">{t('calendar.agendaOverdue')}</h3>
          {/* Overdue days show their month inline (no month header above them). */}
          {agenda.overdue.map((day) => dayGroup(day, true))}
        </section>
      )}
      {/* Emit a month header whenever this day starts a new month (compared to the previous day) —
          the Google-Calendar-mobile-style dividers. Pure: no mutable running state across the map. */}
      {agenda.upcoming.map((day, i) => {
        const showHeader = i === 0 || agenda.upcoming[i - 1].date.slice(0, 7) !== day.date.slice(0, 7);
        return (
          <section key={day.date} className="space-y-2">
            {showHeader && (
              <h3 className="px-1 text-sm font-semibold capitalize text-foreground">{monthLabel(day.date)}</h3>
            )}
            {dayGroup(day, false)}
          </section>
        );
      })}
      {agenda.past.length > 0 && (
        <section className="space-y-2">
          {/* Completed/cancelled past items — neutral, never the red overdue warning (#1000 review, P2). */}
          <h3 className="px-1 text-sm font-semibold text-muted-foreground">{t('calendar.agendaEarlier')}</h3>
          {agenda.past.map((day) => dayGroup(day, true))}
        </section>
      )}
    </div>
  );
}
