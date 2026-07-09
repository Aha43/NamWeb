import { useState } from 'react';
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
}: {
  /** Prefix for the input ids (e.g. `"project"` → `project-due`, `project-due-end`, …). */
  idPrefix: string;
  /** The persisted fields — seeds the drafts and decides whether the extras start open. */
  value: DueFields;
  onCommit: (fields: DueFields) => void;
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
  // The scheduling extras collapse by default; open when the node already carries any (#559).
  const [showExtras, setShowExtras] = useState(
    Boolean(value.dueTime || value.dueEndAt || value.dueEndTime),
  );

  const clearErrors = () => {
    setDueError(false);
    setDueEndError(false);
    setDueTimeError(false);
    setDueEndTimeError(false);
  };

  // Validate the four drafts together (overrides dodge setState's async staleness); on success
  // echo the canonical forms and report the complete set. One bad field blocks only the due
  // commit — never the caller's other fields.
  const commitIfValid = (override: Partial<{ due: string; dueEnd: string; dueTime: string; dueEndTime: string }> = {}) => {
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
    onCommit({ dueAt, dueEndAt: endAt, dueTime: timeValue, dueEndTime: endTimeValue });
  };

  const clearAll = () => {
    setDue('');
    setDueEnd('');
    setDueTime('');
    setDueEndTime('');
    clearErrors();
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
          placeholder={t('editor.duePlaceholder')}
          value={due}
          aria-invalid={dueError}
          onChange={(e) => {
            setDue(e.target.value);
            if (dueError) setDueError(false);
          }}
          onBlur={() => commitIfValid()}
        />
        <DatePickerPopover
          value={parseFlexibleDate(due)}
          onSelect={(isoDate) => { setDue(isoDate); setDueError(false); commitIfValid({ due: isoDate }); }}
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
              placeholder={t('editor.dueEndPlaceholder')}
              className="min-w-0 flex-1"
              value={dueEnd}
              aria-invalid={dueEndError}
              onChange={(e) => {
                setDueEnd(e.target.value);
                if (dueEndError) setDueEndError(false);
              }}
              onBlur={() => commitIfValid()}
            />
            <DatePickerPopover
              value={parseFlexibleDate(dueEnd)}
              onSelect={(isoDate) => { setDueEnd(isoDate); setDueEndError(false); commitIfValid({ dueEnd: isoDate }); }}
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
