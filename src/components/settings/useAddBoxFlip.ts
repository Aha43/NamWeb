import { useRef, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { useSettings } from './settings-context';

/**
 * Returns an add-box input `onKeyDown` handler for **Shift+Enter**: flip the add-to-top/bottom
 * default **and** add the current item at the flipped end too (#450).
 *
 * The wrinkle: each page decides an add's position from the (async) setting, so a plain
 * `setAddToBottom(next); onAdd(title)` would place *this* item using the stale value. We `flushSync`
 * the flip so the page re-renders with the new default, then call `onAdd` through a ref that always
 * holds the latest prop — so this add lands at the flipped end, and every following plain-Enter add
 * does too (the default stays flipped). Plain Enter is untouched (the form's own submit handles it).
 */
export function useAddBoxFlip(
  onAdd: (title: string) => void,
  title: string,
  onAdded: () => void,
): (event: KeyboardEvent) => void {
  const { addToBottom, setAddToBottom } = useSettings();
  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;
  return (event) => {
    if (event.key !== 'Enter' || !event.shiftKey) return;
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    flushSync(() => setAddToBottom(!addToBottom));
    onAddRef.current(trimmed);
    onAdded();
  };
}
