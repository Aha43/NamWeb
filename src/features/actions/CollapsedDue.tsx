import { useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { DueHintLabel } from './DueHintLabel';

/**
 * The due controls, dense until asked for (#721): collapsed, the set time shows as the same
 * compact hint rows carry (range/times, derived edges italic) with an edit affordance — or a
 * "＋ Add due date" opener when nothing is set. Expanding reveals `children` (the full control
 * set: the panel's DueFieldset, the action editor's inline block) and stays open for the rest of
 * the editing session — re-collapsing mid-edit would hide state the user is working on.
 */
export function CollapsedDue({
  fields,
  children,
}: {
  /** What the dense display shows — pass the effective span for deriving projects (#706). */
  fields: {
    dueAt?: string | null;
    dueEndAt?: string | null;
    dueTime?: string | null;
    dueEndTime?: string | null;
    derivedStart?: boolean;
    derivedEnd?: boolean;
  };
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (expanded) return <>{children}</>;
  return (
    <div className="space-y-1.5">
      <Label>{t('editor.fieldDue')}</Label>
      {fields.dueAt ? (
        <div>
          <button
            type="button"
            aria-label={t('editor.editDueAria')}
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent"
          >
            <DueHintLabel {...fields} />
            <Pencil aria-hidden className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t('editor.addDue')}
          </button>
        </div>
      )}
    </div>
  );
}
