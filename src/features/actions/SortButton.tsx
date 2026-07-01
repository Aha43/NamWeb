import { ArrowDownUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SORT_LABEL, type SortMode } from './sort';

/** A toolbar toggle that cycles the list sort order. */
export function SortButton({ mode, onCycle }: { mode: SortMode; onCycle: () => void }) {
  const { t } = useTranslation();
  const label = t(SORT_LABEL[mode]);
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={t('list.sortAria', { label })}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ArrowDownUp className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
