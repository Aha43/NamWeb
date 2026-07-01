import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCopyToClipboard } from '@/lib/useCopyToClipboard';
import { cn } from '@/lib/utils';
import { TOUCH_TARGET } from '@/lib/touch';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * A small icon button that copies `value` to the clipboard, flashing a check on success.
 * Disabled (and dimmed) when there's nothing to copy. `label` names the thing being copied,
 * e.g. "title" → aria-label "Copy title". Pass `tooltip` to add a hover hint with the same wording.
 */
export function CopyButton({
  value,
  label,
  className,
  tooltip = false,
}: {
  value: string;
  label: string;
  className?: string;
  tooltip?: boolean;
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopyToClipboard();
  const empty = value.trim().length === 0;
  const wrap = copied ? t('common.copiedLabel', { label }) : t('common.copyLabel', { label });
  const button = (
    <button
      type="button"
      aria-label={wrap}
      disabled={empty}
      onClick={() => copy(value)}
      className={cn(
        'rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        TOUCH_TARGET,
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
  // Only arm a tooltip when there's something to copy (a disabled button gets no pointer events).
  return tooltip && !empty ? <Tooltip label={wrap}>{button}</Tooltip> : button;
}
