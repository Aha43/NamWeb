import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceContext } from '@/store/workspace-context';
import { formatCount } from '@/domain/resourceCount';
import { nowIso } from '@/lib/local';
import { cn } from '@/lib/utils';

/**
 * A counter's row pill (#798) — the first interactive resource. The +1 dispatches IMMEDIATELY
 * (no editor, no Save buffer; the setStatus family), stale-guarded by expectedValue so a
 * replay or a raced tap can never double-count. Renders read-only without a workspace
 * (presentational hosts, the guest page someday).
 */
export function CountPill({
  nodeId,
  index,
  current,
  target,
  unlimited = false,
  label,
}: {
  nodeId: string;
  index: number;
  current: number;
  target: number;
  /** The target is a goal, not a cap (#800): green at/past it, + keeps counting. */
  unlimited?: boolean;
  label: string | null;
}) {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  const full = current >= target;
  const display = `${current}/${target}`; // the machine marker ("+") stays off the page
  const ariaName = label ?? display;
  const text = `${label ? `${label} ` : ''}${display}`;
  if (!workspace?.dispatch) {
    return (
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
          full ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
        )}
      >
        {text}
      </span>
    );
  }
  // Both directions (#798 stock-keeping: action = use / re-supply): − steps down to zero,
  // + steps up to the target; each edge quietly loses its button.
  const step = (delta: 1 | -1) =>
    workspace.dispatch({
      type: 'incrementCountResource',
      id: nodeId,
      index,
      expectedValue: formatCount(current, target, unlimited),
      delta,
      now: nowIso(),
    });
  return (
    <span
      onClick={(e) => e.stopPropagation()} // the row's own click (edit/select) must not fire
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
        full ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
      )}
    >
      {current > 0 && (
        <button
          type="button"
          aria-label={t('actions.countMinusAria', { label: ariaName })}
          onClick={() => step(-1)}
          className="rounded-full px-1 font-bold hover:bg-accent hover:text-foreground"
        >
          −
        </button>
      )}
      {text}
      {(!full || unlimited) && (
        <button
          type="button"
          aria-label={t('actions.countPlusAria', { label: ariaName })}
          onClick={() => step(1)}
          className="rounded-full px-1 font-bold hover:bg-accent hover:text-foreground"
        >
          +
        </button>
      )}
    </span>
  );
}
