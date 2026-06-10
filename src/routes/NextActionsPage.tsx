import { nextActions } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { NextActionsPanel } from '@/features/next-actions/NextActionsPanel';
import { useWorkspaceContext } from '@/store/workspace-context';

export function NextActionsPage() {
  const { document, dispatch } = useWorkspaceContext();
  return (
    <NextActionsPanel
      rows={document ? nextActions(document).map((n) => toActionRow(document, n)) : []}
      onMarkDone={(id) => dispatch({ type: 'setStatus', id, status: 'DONE', now: nowIso() })}
      onMarkBacklog={(id) => dispatch({ type: 'setStatus', id, status: 'BACKLOG', now: nowIso() })}
    />
  );
}
