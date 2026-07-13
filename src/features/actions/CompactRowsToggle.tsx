import { useTranslation } from 'react-i18next';
import { Rows2, Rows4 } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { useSettings } from '@/components/settings/settings-context';

/**
 * The compact-rows flip (#765) — lives in list headers beside Sort, so you can go dense right
 * where you're relating to the list. Device-persisted; applies to all action lists at once.
 */
export function CompactRowsToggle() {
  const { t } = useTranslation();
  const { compactRows, setCompactRows } = useSettings();
  // Like its SortButton neighbor: the VISIBLE word is the current state (findability — an
  // unlabeled icon between Focus and Sort was invisible in practice); the tooltip says what
  // clicking switches to.
  const switchTo = compactRows ? t('rows.comfortable') : t('rows.compact');
  return (
    <Tooltip label={switchTo}>
      <button
        type="button"
        aria-label={switchTo}
        aria-pressed={compactRows}
        onClick={() => setCompactRows(!compactRows)}
        className="flex items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
      >
        {compactRows ? <Rows4 className="h-3.5 w-3.5" /> : <Rows2 className="h-3.5 w-3.5" />}
        {compactRows ? t('rows.stateCompact') : t('rows.stateComfortable')}
      </button>
    </Tooltip>
  );
}
