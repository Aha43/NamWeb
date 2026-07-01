import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSettings } from './settings-context';

/**
 * A small here-and-now toggle for where new items land — placed beside an add box. Flips the
 * effective (session) position; it resets to your default (Settings → Preferences) on reload.
 */
export function AddPositionToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { addToBottom, setAddToBottom } = useSettings();
  const label = addToBottom ? t('settings.addBottomTip') : t('settings.addTopTip');
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={addToBottom}
        onClick={() => setAddToBottom(!addToBottom)}
        className={cn(
          'shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground',
          className,
        )}
      >
        {addToBottom ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpToLine className="h-4 w-4" />}
      </button>
    </Tooltip>
  );
}
