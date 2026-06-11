import { useState, type KeyboardEvent } from 'react';

/** A single-line title editor: Enter commits (if changed & non-empty), Esc/blur cancels. */
export function InlineRename({
  title,
  onCommit,
  onCancel,
}: {
  title: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(title);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) onCommit(trimmed);
    else onCancel();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <input
      autoFocus
      aria-label={`Rename ${title}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onCancel}
      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-ring"
    />
  );
}
