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

const TONE: Partial<Record<NodeStatus, string>> = {
  NEXT: 'text-primary border-primary/40',
  BACKLOG: 'text-muted-foreground border-border',
  DONE: 'text-green-600 dark:text-green-400 border-green-600/40',
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
  return (
    <DropdownMenu>
      <Tooltip label={t('list.statusTooltip', { status })}>
        <DropdownMenuTrigger
          aria-label={t('list.statusAria', { title, status })}
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
