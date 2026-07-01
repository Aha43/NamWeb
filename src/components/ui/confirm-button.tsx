import { useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { Tooltip } from './tooltip';
import { cn } from '@/lib/utils';
import { TOUCH_TARGET } from '@/lib/touch';

/**
 * A button that asks for confirmation in a small popover **anchored to itself** — so the
 * confirm action is right where you clicked (no mouse-travel to a centered dialog), and
 * Enter confirms / Esc cancels (the confirm button is auto-focused). Replaces `window.confirm`
 * for destructive inline actions. `children` is the trigger content (e.g. a trash icon).
 */
export function ConfirmButton({
  message,
  confirmLabel,
  destructive = true,
  onConfirm,
  children,
  ...trigger
}: {
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Label the (icon) trigger from its own aria-label — no separate prop to keep in sync. Hidden
  // while the popover is open so the tooltip doesn't sit on top of the confirm.
  const tip = !open ? (trigger['aria-label'] ?? undefined) : undefined;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip label={tip}>
        <Popover.Trigger asChild>
          <button type="button" {...trigger} className={cn(TOUCH_TARGET, trigger.className)}>
            {children}
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={4}
          className="z-50 w-64 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <p className="text-sm text-foreground">{message}</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant={destructive ? 'destructive' : 'default'}
              size="sm"
              autoFocus
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel ?? t('common.delete')}
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
