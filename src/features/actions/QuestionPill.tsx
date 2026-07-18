import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceContext } from '@/store/workspace-context';
import { formatQuestion, type QuestionAnswer } from '@/domain/resourceQuestion';
import { nowIso } from '@/lib/local';
import { TOUCH_TARGET } from '@/lib/touch';
import { cn } from '@/lib/utils';

/**
 * A question's row pill (#827) — the second interactive resource. Yes/No, the active answer
 * highlighted; tapping the active answer clears it (undo, owner and guest alike). The toggle
 * is computed HERE and the resulting desired state is dispatched, so the reducer and the
 * guest drain both just SET. Renders read-only without a workspace or an onAnswer host.
 */
export function QuestionPill({
  nodeId,
  index,
  answer,
  question,
  rawValue,
  onAnswer,
}: {
  nodeId: string;
  index: number;
  answer: QuestionAnswer | null;
  question: string;
  /** The STORED value, dispatched verbatim as the stale guard (#802/F3). */
  rawValue?: string;
  /** Hosts with their own write path (the guest page) supply the setter. */
  onAnswer?: (answer: 'yes' | 'no' | 'clear') => void;
}) {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  const interactive = Boolean(workspace?.dispatch || onAnswer);

  const set = (desired: 'yes' | 'no' | 'clear') => {
    if (onAnswer) return onAnswer(desired);
    workspace?.dispatch({
      type: 'answerQuestionResource',
      id: nodeId,
      index,
      expectedValue: rawValue ?? formatQuestion(answer),
      answer: desired,
      now: nowIso(),
    });
  };
  const choose = (a: 'yes' | 'no') => set(answer === a ? 'clear' : a);

  const activeCls = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
  const idleCls = 'text-muted-foreground hover:bg-accent hover:text-foreground';

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px]"
    >
      <span className="font-medium text-foreground">{question}</span>
      {(['yes', 'no'] as const).map((a) => {
        const active = answer === a;
        const label = a === 'yes' ? t('actions.answerYes') : t('actions.answerNo');
        const aria = a === 'yes'
          ? t('actions.questionYesAria', { label: question })
          : t('actions.questionNoAria', { label: question });
        if (!interactive) {
          return active ? (
            <span key={a} className={cn('rounded-full px-1.5 font-semibold', activeCls)}>{label}</span>
          ) : null;
        }
        return (
          <button
            key={a}
            type="button"
            aria-label={aria}
            aria-pressed={active}
            onClick={() => choose(a)}
            className={cn('rounded-full px-1.5 font-semibold', TOUCH_TARGET, active ? activeCls : idleCls)}
          >
            {label}
          </button>
        );
      })}
      {!interactive && answer === null && (
        <span className="text-muted-foreground">{t('guest.questionUnanswered')}</span>
      )}
    </span>
  );
}
