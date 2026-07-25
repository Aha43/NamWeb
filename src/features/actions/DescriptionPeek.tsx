import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * A "read the whole thing" affordance for a description the row tooltip truncates (#940). A subtle
 * chevron sits after the title; clicking it opens a Popover with the full text (scrollable), so you
 * can read a long description without opening the editor. Reliable where an expandable hover tooltip
 * wasn't — a Popover is a real layer: it opens on click and stays until you click away.
 *
 * Only mounted by callers when the description actually exceeds the preview, so the chevron is a quiet
 * "there's more here" cue that appears exactly on the rows that have more.
 */
export function DescriptionPeek({ description }: { description: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = t('actions.descriptionMore');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Tooltip wraps the trigger; both asChild layers clone onto the same button (#679). Hide the
          tooltip while the popover is open so they don't stack. */}
      <Tooltip label={open ? undefined : label}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="shrink-0 rounded p-0.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        role="dialog"
        aria-label={label}
        className="max-h-72 w-80 max-w-[90vw] overflow-y-auto whitespace-pre-wrap break-words text-sm"
      >
        {description.trim()}
      </PopoverContent>
    </Popover>
  );
}
