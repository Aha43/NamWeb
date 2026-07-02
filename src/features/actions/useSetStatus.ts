import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/toast/toast-context';
import { useWorkspaceContext } from '@/store/workspace-context';
import { nowIso } from '@/lib/local';
import type { NodeStatus } from '@/domain/types';

/** Trim a title for a toast message. */
function short(title: string): string {
  return title.length > 40 ? `${title.slice(0, 39)}…` : title;
}

/** What Undo must put back: the status *and* the original change-time. */
interface StatusCapture {
  id: string;
  status: NodeStatus;
  statusChangedAt: string | null;
}

/**
 * Change a node's status and surface a short-lived **Undo** toast — in many views a status change
 * makes the row vanish (Done from Next, restore from Done, …), exactly like a delete, so it gets
 * the same safety net (#567). Undo restores the previous status *and* its original
 * `statusChangedAt`. No-ops (no dispatch, no toast) when the status is unchanged.
 */
export function useSetStatus(): (id: string, status: NodeStatus) => void {
  const { document, dispatch } = useWorkspaceContext();
  const { toast } = useToast();
  const { t } = useTranslation();
  return (id, status) => {
    const node = document?.nodes[id];
    if (!node || node.status === status) return;
    const capture: StatusCapture = { id, status: node.status, statusChangedAt: node.statusChangedAt };
    dispatch({ type: 'setStatus', id, status, now: nowIso() });
    toast({
      message: t('toast.statusSet', {
        title: short(node.title),
        status: t(`domain.status.${status.toLowerCase()}`, { defaultValue: status }),
      }),
      actionLabel: t('common.undo'),
      onAction: () =>
        dispatch({
          type: 'setStatus',
          id: capture.id,
          status: capture.status,
          statusChangedAt: capture.statusChangedAt,
          now: nowIso(),
        }),
    });
  };
}

/**
 * Change several nodes' statuses at once with a single grouped **Undo** toast that restores each
 * node's own previous status. Used by bulk operations (workbench Status ▾, Done's restore/backlog).
 */
export function useSetStatuses(): (ids: string[], status: NodeStatus) => void {
  const { document, dispatch } = useWorkspaceContext();
  const { toast } = useToast();
  const { t } = useTranslation();
  return (ids, status) => {
    if (!document) return;
    const captures: StatusCapture[] = [];
    for (const id of ids) {
      const node = document.nodes[id];
      if (!node || node.status === status) continue;
      captures.push({ id, status: node.status, statusChangedAt: node.statusChangedAt });
      dispatch({ type: 'setStatus', id, status, now: nowIso() });
    }
    if (captures.length === 0) return;
    const statusName = t(`domain.status.${status.toLowerCase()}`, { defaultValue: status });
    toast({
      message:
        captures.length === 1
          ? t('toast.statusSet', {
              title: short(document.nodes[captures[0].id]?.title ?? ''),
              status: statusName,
            })
          : t('toast.statusSetMany', { count: captures.length, status: statusName }),
      actionLabel: t('common.undo'),
      onAction: () => {
        for (const capture of captures) {
          dispatch({
            type: 'setStatus',
            id: capture.id,
            status: capture.status,
            statusChangedAt: capture.statusChangedAt,
            now: nowIso(),
          });
        }
      },
    });
  };
}
