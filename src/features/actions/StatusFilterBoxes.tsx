import { useTranslation } from 'react-i18next';
import { STATUS_BOX_KEYS, type StatusBoxes } from './statusBoxes';

const LABEL_KEY: Record<keyof StatusBoxes, string> = {
  NEXT: 'domain.status.next',
  BACKLOG: 'domain.status.backlog',
  DONE: 'domain.status.done',
};

/**
 * Three include-checkboxes — Next / Backlog / Done — uniform across the list views (#766).
 * Session-local by design: nothing stored changes; the view resets to its own defaults next
 * visit.
 */
export function StatusFilterBoxes({ boxes, onToggle }: { boxes: StatusBoxes; onToggle: (s: keyof StatusBoxes) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground">
      {STATUS_BOX_KEYS.map((status) => (
        <label key={status} className="flex items-center gap-1.5">
          <input type="checkbox" checked={boxes[status]} onChange={() => onToggle(status)} />
          {t(LABEL_KEY[status])}
        </label>
      ))}
    </div>
  );
}
