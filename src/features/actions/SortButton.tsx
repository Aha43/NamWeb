import { ArrowDownUp } from 'lucide-react';
import { SORT_LABEL, type SortMode } from './sort';

/** A toolbar toggle that cycles the list sort order. */
export function SortButton({ mode, onCycle }: { mode: SortMode; onCycle: () => void }) {
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={`Sort: ${SORT_LABEL[mode]}. Click to change.`}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ArrowDownUp className="h-3.5 w-3.5" />
      {SORT_LABEL[mode]}
    </button>
  );
}
