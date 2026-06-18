import { useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Button } from './button';

/**
 * A button that asks for a single line of text in a popover **anchored to itself** — the input
 * counterpart to {@link ConfirmButton}. Replaces `window.prompt`: themed, on-design, no mouse-travel,
 * Enter submits / Esc cancels, input auto-focused & pre-filled. `children` is the trigger content.
 */
export function PromptButton({
  initialValue = '',
  label,
  placeholder,
  submitLabel = 'Save',
  onSubmit,
  children,
  ...trigger
}: {
  initialValue?: string;
  /** Accessible label for the input (e.g. "Rename tag"). */
  label: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  children: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onSubmit'>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(initialValue); // reset to the latest initial each time it opens
      }}
    >
      <Popover.Trigger asChild>
        <button type="button" {...trigger}>
          {children}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={4}
          className="z-50 w-64 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = value.trim();
              if (!trimmed) return;
              onSubmit(trimmed);
              setOpen(false);
            }}
          >
            <input
              aria-label={label}
              autoFocus
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                {submitLabel}
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
