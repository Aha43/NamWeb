import { useTranslation } from 'react-i18next';
import { Rows2, Rows4 } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSettings } from '@/components/settings/settings-context';

/**
 * The compact-rows flip (#765) — lives in list headers beside Sort, so you can go dense right
 * where you're relating to the list. Device-persisted; applies to all action lists at once.
 *
 * The Display **density** preset can also force compact (Compact density). When it does, this toggle
 * shows the effective (compact) state and is disabled — density is in charge, so clicking wouldn't do
 * anything visible (#958 review). Otherwise it flips the standalone compact-rows setting as before.
 */
export function CompactRowsToggle() {
  const { t } = useTranslation();
  const { compactRows, setCompactRows, density } = useSettings();
  const lockedByDensity = density === 'compact';
  const effective = compactRows || lockedByDensity;
  // The VISIBLE word is the current (effective) state; the tooltip says what clicking switches to —
  // or, when density has taken over, that density controls it.
  const tip = lockedByDensity ? t('rows.setByDensity') : effective ? t('rows.comfortable') : t('rows.compact');
  return (
    <Tooltip label={tip}>
      <button
        type="button"
        aria-label={tip}
        aria-pressed={effective}
        disabled={lockedByDensity}
        onClick={() => setCompactRows(!compactRows)}
        className={cn(
          'flex items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent',
          lockedByDensity && 'cursor-not-allowed opacity-50 hover:bg-transparent',
        )}
      >
        {effective ? <Rows4 className="h-3.5 w-3.5" /> : <Rows2 className="h-3.5 w-3.5" />}
        {effective ? t('rows.stateCompact') : t('rows.stateComfortable')}
      </button>
    </Tooltip>
  );
}
