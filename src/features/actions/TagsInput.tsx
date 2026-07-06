import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isSystemTag } from '@/domain/systemTags';

const MAX_SUGGESTIONS = 8;

export interface TagsInputProps {
  id?: string;
  /** Raw comma-separated tag text. */
  value: string;
  onChange: (value: string) => void;
  /** Existing tags to suggest (e.g. allTags). */
  suggestions: string[];
}

/**
 * Comma-separated tags input with an autocomplete dropdown of existing tags —
 * the web counterpart to NamDesktop's `TagsField`. Lets you pick an existing tag
 * (↑/↓ + Enter/Tab, or click) instead of retyping it, which avoids fragmentation
 * (`@phone` vs `phone`). New tags can still be typed freely.
 */
export function TagsInput({ id, value, onChange, suggestions }: TagsInputProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<number | undefined>(undefined);

  const tokens = value.split(',');
  // The tag currently being typed = text after the last comma.
  const current = (tokens[tokens.length - 1] ?? '').trim().toLowerCase();
  const chosen = new Set(tokens.slice(0, -1).map((t) => t.trim().toLowerCase()).filter(Boolean));
  const matches = suggestions
    .filter((s) => !chosen.has(s.toLowerCase()) && s.toLowerCase().includes(current))
    .slice(0, MAX_SUGGESTIONS);

  const open = focused && matches.length > 0;

  function apply(tag: string) {
    const next = tokens.slice(0, -1).map((t) => t.trim()).filter(Boolean);
    next.push(tag);
    onChange(next.join(', ') + ', ');
    setHighlight(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, matches.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        if (matches[highlight]) {
          e.preventDefault();
          apply(matches[highlight]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setFocused(false);
        break;
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        placeholder={t('tags.inputPlaceholder')}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setHighlight(0);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setFocused(false), 120);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          role="listbox"
          aria-label={t('tags.existingTags')}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {matches.map((tag, i) => (
            <li key={tag}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                // onMouseDown (not onClick) so it fires before the input's blur closes the popup.
                onMouseDown={(e) => {
                  e.preventDefault();
                  apply(tag);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'w-full rounded px-2 py-1.5 text-left text-sm',
                  i === highlight ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent',
                )}
              >
                <span className={cn(isSystemTag(tag) && 'font-semibold')}>{tag}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
