import { inboxItems } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import { InboxPanel } from '@/features/inbox/InboxPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function InboxPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  return (
    <InboxPanel
      items={document ? inboxItems(document) : []}
      onAdd={(title) => dispatch({ type: 'addInboxItem', id: newId(), title, now: nowIso() })}
      onConvert={(id) => dispatch({ type: 'convertInboxToNext', id, now: nowIso() })}
      onDelete={(id) => dispatch({ type: 'deleteLeaf', id })}
      onEdit={openEditor}
    />
  );
}
