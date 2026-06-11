import { useState } from 'react';
import { inboxItems } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import { InboxPanel } from '@/features/inbox/InboxPanel';
import { InboxProcessDialog, type ProcessResolution } from '@/features/inbox/InboxProcessDialog';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function InboxPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const items = document ? inboxItems(document) : [];
  const processing = processingId ? items.find((n) => n.id === processingId) ?? null : null;

  function resolve(resolution: ProcessResolution) {
    if (!processingId) return;
    const now = nowIso();
    if (resolution.kind === 'project') {
      dispatch({ type: 'convertInboxToProject', id: processingId, now });
    } else {
      dispatch({ type: 'convertInboxToAction', id: processingId, status: resolution.status, now });
    }
  }

  return (
    <>
      <InboxPanel
        items={items}
        onAdd={(title) => dispatch({ type: 'addInboxItem', id: newId(), title, now: nowIso() })}
        onProcess={setProcessingId}
        onDelete={(id) => dispatch({ type: 'deleteLeaf', id })}
        onEdit={openEditor}
        onRename={(id, title) => {
          const node = document?.nodes[id];
          if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
        }}
      />
      {processing && (
        <InboxProcessDialog
          key={processing.id}
          node={processing}
          open
          onOpenChange={(open) => {
            if (!open) setProcessingId(null);
          }}
          onResolve={resolve}
        />
      )}
    </>
  );
}
