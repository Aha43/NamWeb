import { type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

/**
 * A themed tooltip wrapping a single trigger (rendered `asChild`, so the trigger keeps its own
 * element/handlers). Pointer + keyboard-focus driven; on touch there is no hover so it stays out of
 * the way. An empty/falsy `label` renders the child with no tooltip — handy for "only when needed"
 * cases (e.g. a name that isn't actually truncated).
 *
 * Self-contained (it carries its own `Provider`) so it works anywhere — including components
 * rendered in isolation in tests — without a global provider to wire up. A snappy 300ms delay.
 */
export function Tooltip({
  label,
  side = 'top',
  children,
}: {
  label: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}) {
  if (!label) return <>{children}</>;
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0"
          >
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
