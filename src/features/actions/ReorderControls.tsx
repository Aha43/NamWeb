import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-col">
      <Tooltip label={onUp ? t('list.moveUp') : ''}>
        <button
          type="button"
          aria-label={t('list.moveUpAria', { title })}
          disabled={!onUp}
          onClick={onUp}
          className="rounded-sm p-1 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip label={onDown ? t('list.moveDown') : ''}>
        <button
          type="button"
          aria-label={t('list.moveDownAria', { title })}
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
