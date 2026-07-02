import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { NodeStatus } from '@/domain/types';

/** Status → text color. Shared so the badge and the action-title coloring (ActionRow) stay in sync. */
export const STATUS_TEXT_TONE: Partial<Record<NodeStatus, string>> = {
  NEXT: 'text-primary',
  BACKLOG: 'text-muted-foreground',
  DONE: 'text-green-600 dark:text-green-400',
};

// The badge = the shared text tone + a matching border.
const TONE: Partial<Record<NodeStatus, string>> = {
  NEXT: cn(STATUS_TEXT_TONE.NEXT, 'border-primary/40'),
  BACKLOG: cn(STATUS_TEXT_TONE.BACKLOG, 'border-border'),
  DONE: cn(STATUS_TEXT_TONE.DONE, 'border-green-600/40'),
};
const OPTIONS: { status: NodeStatus; label: string }[] = [
  { status: 'NEXT', label: 'domain.status.next' },
  { status: 'BACKLOG', label: 'domain.status.backlog' },
  { status: 'DONE', label: 'domain.status.done' },
];

/** A status badge (N/B/D) that opens a menu to switch Next / Backlog / Done. */
export function StatusMenu({
  status,
  title,
  onSetStatus,
}: {
  status: NodeStatus;
  title: string;
  onSetStatus: (status: NodeStatus) => void;
}) {
  const { t } = useTranslation();
  // Locale-aware single-letter badge (en N/B/D, nb N/E/F); unknown statuses fall back to the initial.
  const short = t(`domain.statusShort.${status.toLowerCase()}`, { defaultValue: status[0] });
  // The tooltip/aria show the translated status name, not the raw enum (which leaked into nb).
  const statusName = t(`domain.status.${status.toLowerCase()}`, { defaultValue: status });
  return (
    <DropdownMenu>
      <Tooltip label={t('list.statusTooltip', { status: statusName })}>
        <DropdownMenuTrigger
          aria-label={t('list.statusAria', { title, status: statusName })}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-semibold outline-hidden hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
            TONE[status] ?? 'text-muted-foreground border-border',
          )}
        >
          {short}
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={option.status} onSelect={() => onSetStatus(option.status)}>
            {t(option.label)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
