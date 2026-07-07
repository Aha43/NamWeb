import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { calendarMonth, localDateString } from '@/domain/calendar';
import { MonthGrid } from '@/features/calendar/MonthGrid';
import { useWorkspaceContext } from '@/store/workspace-context';

/**
 * The global calendar (#675) — a thin shell around interchangeable calendar *views*: header with
 * «‹›» month/year navigation + Today, then the view. The classic month grid is the first view;
 * the `view` URL param is reserved for future ones (a list view, an inner view toolbar) so they
 * can slot in without reshaping this page. The shown month lives in `?m=YYYY-MM`, so browser
 * back/forward and bookmarks behave.
 */
export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const { document } = useWorkspaceContext();
  const [params, setParams] = useSearchParams();

  const now = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(params.get('m') ?? '');
  const year = m ? Number(m[1]) : now.getFullYear();
  const month = m ? Number(m[2]) : now.getMonth() + 1; // 1-12

  function show(y: number, mo: number) {
    // Normalize (month 0 → Dec of prev year, 13 → Jan of next).
    const d = new Date(y, mo - 1, 1);
    setParams({ m: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  }

  if (!document) return null;
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
      <MonthGrid days={days} today={localDateString(now)} />
    </div>
  );
}
