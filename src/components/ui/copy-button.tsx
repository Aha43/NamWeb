import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/lib/useCopyToClipboard';
import { cn } from '@/lib/utils';

/**
 * A small icon button that copies `value` to the clipboard, flashing a check on success.
 * Disabled (and dimmed) when there's nothing to copy. `label` names the thing being copied,
 * e.g. "title" → aria-label "Copy title".
 */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const { copied, copy } = useCopyToClipboard();
  const empty = value.trim().length === 0;
  return (
    <button
      type="button"
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      disabled={empty}
      onClick={() => copy(value)}
      className={cn(
        'rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
