import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

/** A single-line title editor: Enter and blur commit (if changed & non-empty), Esc cancels. */
export function InlineRename({
  title,
  onCommit,
  onCancel,
}: {
  title: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(title);
  // Blur COMMITS (#782): the mobile keyboard's checkmark dismisses the keyboard — a blur — and
  // cancel-on-blur silently ate every phone edit. Escape stays the deliberate cancel; the ref
  // keeps the trailing blur (after Enter/Escape unmount paths) from double-firing.
  const settledRef = useRef(false);

  function commit() {
    if (settledRef.current) return;
    settledRef.current = true;
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) onCommit(trimmed);
    else onCancel();
  }

  function cancel() {
    if (settledRef.current) return;
    settledRef.current = true;
    onCancel();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  return (
    <input
      autoFocus
      // Re-arming on focus makes the fresh-mount-per-edit contract non-load-bearing (#786):
      // a future host that keeps the editor mounted gets a working second edit, not a dead one.
      onFocus={() => {
        settledRef.current = false;
      }}
      aria-label={t('actions.renameAria', { title })}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-hidden focus:border-ring"
    />
  );
}
