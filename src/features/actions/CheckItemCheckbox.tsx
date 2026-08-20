import { useTranslation } from 'react-i18next';

/**
 * The done-toggle for a `#checklist` project's check-item (#1153) — a checkbox that stands in for the
 * status dropdown. Checked means `DONE`; `onToggle` reports the new done-state and the caller maps it
 * to a status (checked → DONE, unchecked → BACKLOG). Mirrors the raw select-checkbox styling in
 * `ActionRow`; sits in the row's trailing controls, so it never collides with the bulk-select box.
 */
export function CheckItemCheckbox({
  done,
  title,
  onToggle,
}: {
  done: boolean;
  title: string;
  onToggle: (done: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <input
      type="checkbox"
      aria-label={t('checklist.itemAria', { title })}
      checked={done}
      onChange={(e) => onToggle(e.target.checked)}
      className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
    />
  );
}
