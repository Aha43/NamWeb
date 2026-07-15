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
  label,
}: {
  nodeId: string;
  index: number;
  current: number;
  target: number;
  label: string | null;
}) {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  const full = current >= target;
  const text = `${label ? `${label} ` : ''}${formatCount(current, target)}`;
  if (full || !workspace?.dispatch) {
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
  return (
    <button
      type="button"
      aria-label={t('actions.countPlusAria', { label: label ?? formatCount(current, target) })}
      onClick={(e) => {
        e.stopPropagation(); // the row's own click (edit/select) must not fire
        workspace.dispatch({
          type: 'incrementCountResource',
          id: nodeId,
          index,
          expectedValue: formatCount(current, target),
          now: nowIso(),
        });
      }}
      className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {text} <span aria-hidden className="font-bold">+</span>
    </button>
  );
}
