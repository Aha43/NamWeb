import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { CalendarDay } from '@/domain/calendar';

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

  return (
    <div role="grid" aria-label={t('calendar.gridAria')} className="grid grid-cols-7 gap-1">
      {weekdayNames.map((name) => (
        <div key={name} className="px-1 pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {name}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <div key={`lead-${i}`} aria-hidden />
      ))}
      {days.map((day) => {
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
      })}
    </div>
  );
}
