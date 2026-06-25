import { ChevronDown, ChevronUp } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

/** Up/down controls for hand-ordering a row. A missing handler disables that direction (an end
 *  of the list). Used in the Next/Backlog lists' "Unsorted" (manual) mode. */
export function ReorderControls({
  title,
  onUp,
  onDown,
}: {
  title: string;
  onUp?: () => void;
  onDown?: () => void;
}) {
  return (
    <div className="flex flex-col">
      <Tooltip label={onUp ? 'Move up' : ''}>
        <button
          type="button"
          aria-label={`Move ${title} up`}
          disabled={!onUp}
          onClick={onUp}
          className="rounded-sm p-1 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip label={onDown ? 'Move down' : ''}>
        <button
          type="button"
          aria-label={`Move ${title} down`}
          disabled={!onDown}
          onClick={onDown}
          className="rounded-sm p-1 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
}
