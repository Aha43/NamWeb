import { CheckSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TOUCH_TARGET } from '@/lib/touch';

/** The "enter/exit select" toggle for a list header (#921) — shared so every list looks the same. */
export function SelectToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const label = active ? t('list.exitSelect') : t('list.selectItems');
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onToggle}
        className={cn(
          'rounded-md p-1 hover:bg-accent hover:text-foreground',
          TOUCH_TARGET,
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <CheckSquare className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}
