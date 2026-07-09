import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePickerPopover } from '@/components/ui/date-picker';
import { parseFlexibleDate, parseFlexibleTime } from '@/lib/dates';

/** The four due fields a node can carry (#438/#493/#500) — what `onCommit` reports. */
export interface DueFields {
  dueAt: string | null;
  dueEndAt: string | null;
  dueTime: string | null;
  dueEndTime: string | null;
}

/**
 * The full due-editing block — start date + picker, the collapsed "＋ Add time or a range"
 * extras (#559): start time, end date + picker, end time — with the action editor's parsing
 * (flexible dates/times, canonical echo on blur) and validation rules (end ≥ start; on a
 * same-day range the end time can't precede the start time, #508). Extracted for the project
 * Details panel so projects get the exact controls actions have (#699); commit-on-blur:
 * every valid change reports the complete `DueFields` via `onCommit`, invalid entries flag
 * their field and report nothing (the caller's persisted value stays).
 */
export function DueFieldset({
  idPrefix,
  value,
  onCommit,
  placeholders,
}: {
  /** Prefix for the input ids (e.g. `"project"` → `project-due`, `project-due-end`, …). */
  idPrefix: string;
  /** The persisted fields — seeds the drafts and decides whether the extras start open. */
  value: DueFields;
  onCommit: (fields: DueFields) => void;
  /** Ghost values for derived edges (#706) — shown as the input placeholder while the draft is
   *  empty (typing makes the edge explicit; clearing falls back to the ghost). */
  placeholders?: { dueAt?: string | null; dueEndAt?: string | null };
}) {
  const { t } = useTranslation();
  const [due, setDue] = useState(value.dueAt ?? '');
  const [dueEnd, setDueEnd] = useState(value.dueEndAt ?? '');
  const [dueTime, setDueTime] = useState(value.dueTime ?? '');
  const [dueEndTime, setDueEndTime] = useState(value.dueEndTime ?? '');
  const [dueError, setDueError] = useState(false);
  const [dueEndError, setDueEndError] = useState(false);
  const [dueTimeError, setDueTimeError] = useState(false);
  const [dueEndTimeError, setDueEndTimeError] = useState(false);
  // The scheduling extras collapse by default; open when the node already carries any (#559) —
  // or when a derived end has a ghost to show (#706).
  const [showExtras, setShowExtras] = useState(
    Boolean(value.dueTime || value.dueEndAt || value.dueEndTime || placeholders?.dueEndAt),
  );
  // A ghost end appearing later (the derive toggle flipped on) reveals the extras too. Opens
  // only — never re-collapses, so it can't fight the user's own expander click.
  useEffect(() => {
    if (placeholders?.dueEndAt) setShowExtras(true);
  }, [placeholders?.dueEndAt]);

  const clearErrors = () => {
    setDueError(false);
    setDueEndError(false);
    setDueTimeError(false);
    setDueEndTimeError(false);
  };

  // Whether the user has edited since the last commit. Blurring untouched inputs commits
  // nothing, and pristine drafts resync when `value` changes underneath (another device edited
  // the dates while this panel was open) — the review-found clobber's last path (#711). A remote
  // change DURING an active edit stays last-writer-wins, the app's existing conflict model.
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (dirtyRef.current) return;
    setDue(value.dueAt ?? '');
    setDueEnd(value.dueEndAt ?? '');
    setDueTime(value.dueTime ?? '');
    setDueEndTime(value.dueEndTime ?? '');
    clearErrors();
  }, [value.dueAt, value.dueEndAt, value.dueTime, value.dueEndTime]);

  // Validate the four drafts together (overrides dodge setState's async staleness); on success
  // echo the canonical forms and report the complete set. One bad field blocks only the due
  // commit — never the caller's other fields.
  const commitIfValid = (override: Partial<{ due: string; dueEnd: string; dueTime: string; dueEndTime: string }> = {}) => {
    if (!dirtyRef.current) return; // untouched inputs report nothing on blur (#711)
    const rawDue = override.due ?? due;
    const rawEnd = override.dueEnd ?? dueEnd;
    const rawTime = override.dueTime ?? dueTime;
    const rawEndTime = override.dueEndTime ?? dueEndTime;

    const dueAt = rawDue.trim() ? parseFlexibleDate(rawDue) : null;
    if (rawDue.trim() && dueAt === null) {
      setDueError(true);
      return;
    }
    const dueEndAt = rawEnd.trim() ? parseFlexibleDate(rawEnd) : null;
    if (rawEnd.trim() && (dueEndAt === null || !dueAt || dueEndAt < dueAt)) {
      setDueEndError(true);
      return;
    }
    const dueTimeValue = rawTime.trim() ? parseFlexibleTime(rawTime) : null;
    if (rawTime.trim() && dueTimeValue === null) {
      setDueTimeError(true);
      return;
    }
    const dueEndTimeValue = rawEndTime.trim() ? parseFlexibleTime(rawEndTime) : null;
    if (rawEndTime.trim() && dueEndTimeValue === null) {
      setDueEndTimeError(true);
      return;
    }
    if (dueAt && dueEndAt && dueAt === dueEndAt && dueTimeValue && dueEndTimeValue && dueEndTimeValue < dueTimeValue) {
      setDueEndTimeError(true);
      return;
    }

    clearErrors();
    // Echo canonical forms (26-7-4 → 2026-07-04, 14 → 14:00) to confirm what was parsed.
    setDue(dueAt ?? '');
    const endAt = dueAt ? dueEndAt : null;
    setDueEnd(endAt ?? '');
    const timeValue = dueAt ? dueTimeValue : null;
    setDueTime(timeValue ?? '');
    const endTimeValue = endAt ? dueEndTimeValue : null;
    setDueEndTime(endTimeValue ?? '');
    dirtyRef.current = false; // committed — drafts are canonical again
    onCommit({ dueAt, dueEndAt: endAt, dueTime: timeValue, dueEndTime: endTimeValue });
  };

  const clearAll = () => {
    setDue('');
    setDueEnd('');
    setDueTime('');
    setDueEndTime('');
    clearErrors();
    dirtyRef.current = false;
    onCommit({ dueAt: null, dueEndAt: null, dueTime: null, dueEndTime: null });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={`${idPrefix}-due`}>{t('editor.fieldDue')}</Label>
        {(due || dueEnd || dueTime || dueEndTime) && (
          <button type="button" onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">
            {t('common.clear')}
          </button>
        )}
      </div>
      {/* Type-in stays primary; the calendar button is an optional way to see weekdays (#499). */}
      <div className="flex gap-1.5">
        <Input
          id={`${idPrefix}-due`}
          className="min-w-0 flex-1"
          placeholder={placeholders?.dueAt ?? t('editor.duePlaceholder')}
          // A ghost is a real derived value, not sample text — say so without hover-hunting (#709).
          title={placeholders?.dueAt && !due ? t('actions.derivedFromContents') : undefined}
          value={due}
          aria-invalid={dueError}
          onChange={(e) => {
            dirtyRef.current = true;
            setDue(e.target.value);
            if (dueError) setDueError(false);
          }}
          onBlur={() => commitIfValid()}
        />
        <DatePickerPopover
          value={parseFlexibleDate(due)}
          onSelect={(isoDate) => { dirtyRef.current = true; setDue(isoDate); setDueError(false); commitIfValid({ due: isoDate }); }}
          label={t('editor.pickDueDate')}
        />
      </div>
      {!showExtras && (
        <button
          type="button"
          onClick={() => setShowExtras(true)}
          className="self-start text-xs text-muted-foreground hover:text-foreground"
        >
          {t('editor.addDueExtras')}
        </button>
      )}
      {showExtras && (
        <>
          {/* Optional time of day on the start (#493). */}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs text-muted-foreground">{t('editor.at')}</span>
            <Input
              id={`${idPrefix}-due-time`}
              aria-label={t('editor.dueTimeAria')}
              placeholder={t('editor.dueTimePlaceholder')}
              className="min-w-0 flex-1"
              value={dueTime}
              aria-invalid={dueTimeError}
              onChange={(e) => {
                dirtyRef.current = true;
                setDueTime(e.target.value);
                if (dueTimeError) setDueTimeError(false);
              }}
              onBlur={() => commitIfValid()}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs text-muted-foreground">{t('editor.to')}</span>
            <Input
              id={`${idPrefix}-due-end`}
              aria-label={t('editor.dueEndAria')}
              placeholder={placeholders?.dueEndAt ?? t('editor.dueEndPlaceholder')}
              title={placeholders?.dueEndAt && !dueEnd ? t('actions.derivedFromContents') : undefined}
              className="min-w-0 flex-1"
              value={dueEnd}
              aria-invalid={dueEndError}
              onChange={(e) => {
                dirtyRef.current = true;
                setDueEnd(e.target.value);
                if (dueEndError) setDueEndError(false);
              }}
              onBlur={() => commitIfValid()}
            />
            <DatePickerPopover
              value={parseFlexibleDate(dueEnd)}
              onSelect={(isoDate) => { dirtyRef.current = true; setDueEnd(isoDate); setDueEndError(false); commitIfValid({ dueEnd: isoDate }); }}
              label={t('editor.pickEndDate')}
            />
          </div>
          {/* Optional time of day on the end (#500). */}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs text-muted-foreground">{t('editor.at')}</span>
            <Input
              id={`${idPrefix}-due-end-time`}
              aria-label={t('editor.dueEndTimeAria')}
              placeholder={t('editor.dueEndTimePlaceholder')}
              className="min-w-0 flex-1"
              value={dueEndTime}
              aria-invalid={dueEndTimeError}
              onChange={(e) => {
                dirtyRef.current = true;
                setDueEndTime(e.target.value);
                if (dueEndTimeError) setDueEndTimeError(false);
              }}
              onBlur={() => commitIfValid()}
            />
          </div>
        </>
      )}
      {dueError && (
        <p role="alert" className="text-xs text-destructive">
          {t('editor.dueError')}
        </p>
      )}
      {dueEndError && (
        <p role="alert" className="text-xs text-destructive">
          {t('editor.dueEndError')}
        </p>
      )}
      {(dueTimeError || dueEndTimeError) && (
        <p role="alert" className="text-xs text-destructive">
          {t('editor.dueTimeError')}
        </p>
      )}
    </div>
  );
}
