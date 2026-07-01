import { useState, type KeyboardEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { Tooltip } from './tooltip';
import { cn } from '@/lib/utils';
import { TOUCH_TARGET } from '@/lib/touch';

const MAX_SUGGESTIONS = 8;

/**
 * A button that asks for a single line of text in a popover **anchored to itself** — the input
 * counterpart to {@link ConfirmButton}. Replaces `window.prompt`: themed, on-design, no mouse-travel,
 * Enter submits / Esc cancels, input auto-focused & pre-filled. `children` is the trigger content.
 * Optional `suggestions` shows an autocomplete dropdown (e.g. existing tags) you can pick from.
 */
export function PromptButton({
  initialValue = '',
  label,
  placeholder,
  submitLabel,
  suggestions,
  onSubmit,
  children,
  ...trigger
}: {
  initialValue?: string;
  /** Accessible label for the input (e.g. "Rename tag"). */
  label: string;
  placeholder?: string;
  submitLabel?: string;
  /** Existing values to suggest as you type (autocomplete dropdown). */
  suggestions?: string[];
  onSubmit: (value: string) => void;
  children: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onSubmit'>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [highlight, setHighlight] = useState(0);
  // Label the (icon) trigger from its own aria-label; hidden while the input popover is open.
  const tip = !open ? (trigger['aria-label'] ?? undefined) : undefined;

  const q = value.trim().toLowerCase();
  const matches = (suggestions ?? [])
    .filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
    .slice(0, MAX_SUGGESTIONS);
  const showList = matches.length > 0;

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setValue(initialValue); // reset to the latest initial each time it opens
          setHighlight(0);
        }
      }}
    >
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // If a suggestion is highlighted, Enter picks it instead of submitting.
              if (showList && matches[highlight]) {
                setValue(matches[highlight]);
                return;
              }
              submit();
            }}
          >
            <input
              aria-label={label}
              autoFocus
              autoComplete="off"
              role="combobox"
              aria-expanded={showList}
              aria-autocomplete="list"
              value={value}
              placeholder={placeholder}
              onChange={(e) => {
                setValue(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
            />
            {showList && (
              <ul
                role="listbox"
                aria-label={t('common.suggestions')}
                className="mt-1 max-h-44 overflow-auto rounded-md border border-border bg-popover p-1"
              >
                {matches.map((s, i) => (
                  <li key={s}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlight}
                      // onMouseDown so it fires before the input blurs.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setValue(s);
                        setHighlight(0);
                      }}
                      onMouseEnter={() => setHighlight(i)}
                      className={cn(
                        'w-full rounded px-2 py-1.5 text-left text-sm',
                        i === highlight ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent',
                      )}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" size="sm">
                {submitLabel ?? t('common.save')}
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
