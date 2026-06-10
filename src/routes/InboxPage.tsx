import { inboxItems } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import { InboxPanel } from '@/features/inbox/InboxPanel';
import { useWorkspaceContext } from '@/store/workspace-context';

export function InboxPage() {
  const { document, dispatch } = useWorkspaceContext();
  return (
    <InboxPanel
      items={document ? inboxItems(document) : []}
      onAdd={(title) => dispatch({ type: 'addInboxItem', id: newId(), title, now: nowIso() })}
      onConvert={(id) => dispatch({ type: 'convertInboxToNext', id, now: nowIso() })}
      onDelete={(id) => dispatch({ type: 'deleteLeaf', id })}
    />
  );
}
