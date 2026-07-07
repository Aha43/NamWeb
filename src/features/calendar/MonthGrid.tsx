import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isoWeek, type CalendarDay } from '@/domain/calendar';

/**
 * The classic month grid (#675) — the global calendar's first view. Monday-start weeks, localized
 * weekday headers, today ringed. Day boxes are deliberately small summaries: the count of open
 * actions due that day (ranges cover each day they span) and the overdue warning tint on past
 * days with unfinished work. Presentational — the page owns month state and (later, #676) day
 * selection via `onSelectDay`.
 */
export function MonthGrid({
  days,
  today,
  onSelectDay,
}: {
  days: CalendarDay[];
  /** Local YYYY-MM-DD of the current day (ringed when it falls in the shown month). */
  today: string;
  onSelectDay?: (date: string) => void;
}) {
  const { t, i18n } = useTranslation();
  // Monday-start weekday headers, localized. 2024-01-01 was a Monday.
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)),
  );
  // Leading blanks: how far into the Monday-start week the 1st falls.
  const first = days[0] ? new Date(`${days[0].date}T00:00:00`) : new Date();
  const lead = (first.getDay() + 6) % 7;

  // Chunk into week rows so each can carry its ISO week number in the left gutter (#680).
  const cells: (CalendarDay | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div role="grid" aria-label={t('calendar.gridAria')} className="grid grid-cols-[auto_repeat(7,1fr)] gap-1">
      <div aria-hidden />
      {weekdayNames.map((name) => (
        <div key={name} className="px-1 pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {name}
        </div>
      ))}
      {weeks.map((week) => {
        const firstDay = week.find((c) => c !== null)!;
        const weekNo = isoWeek(new Date(`${firstDay.date}T00:00:00`));
        return [
          <Tooltip key={`w${weekNo}-tip`} label={t('calendar.weekTooltip', { week: weekNo })}>
            <div
              aria-label={t('calendar.weekTooltip', { week: weekNo })}
              className="flex min-h-14 items-center justify-center px-1 text-xs font-medium text-sky-600 dark:text-sky-400"
            >
              {weekNo}
            </div>
          </Tooltip>,
          ...week.map((day, i) => (day === null ? <div key={`b-${weekNo}-${i}`} aria-hidden /> : renderDay(day))),
        ];
      })}
    </div>
  );

  function renderDay(day: CalendarDay) {
    const dayNo = Number(day.date.slice(-2));
    const isToday = day.date === today;
    const body = (
      <>
        <span className="text-[11px] leading-none text-muted-foreground">{dayNo}</span>
        {day.count > 0 && (
          <span
            className={cn(
              'mt-1 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold',
              day.overdue ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary',
            )}
          >
            {day.count}
          </span>
        )}
      </>
    );
    const className = cn(
      'flex min-h-14 flex-col items-start rounded-md border border-border/60 p-1.5 text-left',
      isToday && 'ring-2 ring-primary',
      day.overdue && 'bg-destructive/5',
      onSelectDay && 'transition-colors hover:bg-accent',
    );
    return onSelectDay ? (
      <button
        key={day.date}
        type="button"
        aria-label={t('calendar.dayAria', { date: day.date, count: day.count })}
        onClick={() => onSelectDay(day.date)}
        className={className}
      >
        {body}
      </button>
    ) : (
      <div key={day.date} aria-label={t('calendar.dayAria', { date: day.date, count: day.count })} className={className}>
        {body}
      </div>
    );
  }
}
