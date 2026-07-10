import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/toast/toast-context';
import { useWorkspaceContext } from '@/store/workspace-context';
import { nowIso } from '@/lib/local';
import { IN_PROGRESS_TAG, canonicalTag } from '@/domain/systemTags';
import { statusLabel } from './status';
import type { NodeStatus } from '@/domain/types';

/** Trim a title for a toast message. */
function short(title: string): string {
  return title.length > 40 ? `${title.slice(0, 39)}…` : title;
}

/** What Undo must put back: the status, the original change-time — and the in-progress mark,
 *  which terminal statuses strip (#716); an accidental Done must not lose it (#724). */
interface StatusCapture {
  id: string;
  status: NodeStatus;
  statusChangedAt: string | null;
  hadInProgress: boolean;
}

/**
 * Change several nodes' statuses at once with a single **Undo** toast that restores each node's
 * own previous status *and* its original `statusChangedAt` (#567). Nodes already in the target
 * status are skipped; when nothing changes there is no dispatch and no toast. A one-element call
 * gets the single-item message — `useSetStatus` is just this with one id.
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
      captures.push({
        id,
        status: node.status,
        statusChangedAt: node.statusChangedAt,
        hadInProgress: node.tags.some((tag) => canonicalTag(tag) === IN_PROGRESS_TAG),
      });
      dispatch({ type: 'setStatus', id, status, now: nowIso() });
    }
    if (captures.length === 0) return;
    const statusName = statusLabel(t, status);
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
            expectedStatus: status, // stale Undo must not overwrite a newer change (#573)
            // Terminal statuses strip the in-progress mark (#716); an Undo of an accidental
            // Done puts it back (#724). Reducer-side so the expectedStatus guard, fresh state,
            // and sync conflict-replay all apply.
            restoreInProgress: capture.hadInProgress,
            now: nowIso(),
          });
        }
      },
    });
  };
}

/**
 * Change one node's status with the same short-lived **Undo** toast — in many views a status
 * change makes the row vanish (Done from Next, restore from Done, …), exactly like a delete, so
 * it gets the same safety net (#567). Delegates to {@link useSetStatuses} so the two paths can't
 * drift (#582).
 */
export function useSetStatus(): (id: string, status: NodeStatus) => void {
  const setMany = useSetStatuses();
  return (id, status) => setMany([id], status);
}
