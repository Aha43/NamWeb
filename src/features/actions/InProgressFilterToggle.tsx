import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * A list-header chip that filters the view to **in-progress only** (#968) — the `#in-progress`
 * counterpart to the status include-boxes. On/off; callers own the state and apply the filter.
 * Matches the amber in-progress cue (Activity icon).
 */
export function InProgressFilterToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const label = active ? t('inProgressFilter.showAll') : t('inProgressFilter.only');
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onToggle}
        className={cn(
          'flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
          active
            ? 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400'
            : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Activity className="h-3.5 w-3.5" />
        {t('inProgressFilter.label')}
      </button>
    </Tooltip>
  );
}
