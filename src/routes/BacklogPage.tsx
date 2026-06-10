import { backlogItems } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { BacklogPanel } from '@/features/backlog/BacklogPanel';
import { useWorkspaceContext } from '@/store/workspace-context';

export function BacklogPage() {
  const { document, dispatch } = useWorkspaceContext();
  return (
    <BacklogPanel
      rows={document ? backlogItems(document).map((n) => toActionRow(document, n)) : []}
      onPromote={(id) => dispatch({ type: 'setStatus', id, status: 'NEXT', now: nowIso() })}
    />
  );
}
