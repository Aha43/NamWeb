import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { NodeStatus } from '@/domain/types';

type ActiveStatus = 'NEXT' | 'BACKLOG' | 'DONE';

const LETTER: Record<ActiveStatus, string> = { NEXT: 'N', BACKLOG: 'B', DONE: 'D' };
const TONE: Record<ActiveStatus, string> = {
  NEXT: 'text-primary border-primary/40',
  BACKLOG: 'text-muted-foreground border-border',
  DONE: 'text-green-600 dark:text-green-400 border-green-600/40',
};
const OPTIONS: { status: ActiveStatus; label: string }[] = [
  { status: 'NEXT', label: 'Next' },
  { status: 'BACKLOG', label: 'Backlog' },
  { status: 'DONE', label: 'Done' },
];

/** A status badge (N/B/D) that opens a menu to switch Next / Backlog / Done. */
export function StatusMenu({
  status,
  title,
  onSetStatus,
}: {
  status: ActiveStatus;
  title: string;
  onSetStatus: (status: NodeStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Status of ${title}: ${status}. Change status.`}
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
          TONE[status],
        )}
      >
        {LETTER[status]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={option.status} onSelect={() => onSetStatus(option.status)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
