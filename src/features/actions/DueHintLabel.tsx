import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatDate, formatDueHint, type DueTone } from '@/lib/dates';
import { useSettings } from '@/components/settings/settings-context';
import { Tooltip } from '@/components/ui/tooltip';

const DUE_TONE: Record<DueTone, string> = {
  overdue: 'text-red-600 dark:text-red-400',
  today: 'text-amber-600 dark:text-amber-400',
  soon: 'text-blue-600 dark:text-blue-400',
  later: 'text-muted-foreground',
};

/**
 * The compact urgency-toned due label rows carry — "Due Today 14:00 – Jul 12" — range- and
 * time-aware, honoring the date-format setting. Extracted from ActionRow so project rows can
 * tell time the same way (#700). Derived edges (a project deriving from its contents, #706)
 * render italic with a "derived from contents" tooltip. Renders nothing without a due date.
 */
export function DueHintLabel({
  dueAt,
  dueEndAt,
  dueTime,
  dueEndTime,
  derivedStart = false,
  derivedEnd = false,
}: {
  dueAt?: string | null;
  dueEndAt?: string | null;
  dueTime?: string | null;
  dueEndTime?: string | null;
  /** The edge came from the project's contents (`effectiveDue`), not a typed date (#706). */
  derivedStart?: boolean;
  derivedEnd?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { dateFormat } = useSettings();
  const due = dueAt ? formatDueHint(dueAt, undefined, dateFormat, t, i18n.language) : null;
  if (!due) return null;
  // A date range: append the end date when it's set and not before the start.
  const end = dueAt && dueEndAt && dueEndAt >= dueAt ? formatDate(dueEndAt, dateFormat, i18n.language) : null;
  // Optional times of day on the start (#493) and end (#500).
  const time = dueTime ?? null;
  const endTime = end && dueEndTime ? dueEndTime : null;
  const label = (
    <span className={cn('text-[11px] font-medium whitespace-nowrap', DUE_TONE[due.tone])}>
      <span className={cn(derivedStart && 'italic')}>
        {t('actions.dueLabel', { label: due.label })}
        {time && ` ${time}`}
      </span>
      {end && <span className={cn(derivedEnd && 'italic')}>{` – ${end}`}{endTime && ` ${endTime}`}</span>}
    </span>
  );
  return derivedStart || derivedEnd ? <Tooltip label={t('actions.derivedFromContents')}>{label}</Tooltip> : label;
}
