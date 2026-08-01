import { ChevronRight, Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { DueHintLabel } from '@/features/actions/DueHintLabel';
import type { EffectiveDue } from '@/domain/derivedDue';

/**
 * A dated project as a calendar list row (#703/#995): a folder-marked, due-hinted button that opens
 * the project's workbench. A self-contained bordered card (matching `ActionRow`) so it can sit in a
 * `flex-col gap` list interleaved with action rows in the day drill-in and the agenda view. No
 * create-project affordance — the calendar is for viewing dated work.
 */
export function CalendarProjectRow({ title, due, onOpen }: { title: string; due: EffectiveDue; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <li className="list-none overflow-hidden rounded-md border border-border bg-card/60">
      <button
        type="button"
        aria-label={t('column.openAria', { title })}
        onClick={onOpen}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/40"
      >
        <Folder className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
        <TruncatedTitle text={title} className="min-w-0 flex-1 text-sm text-foreground" />
        <DueHintLabel {...due} />
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}
