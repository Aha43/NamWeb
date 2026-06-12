import { useState } from 'react';
import { allTags, contextItems } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { TagFilterPanel } from '@/features/tags/TagFilterPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function TagsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const [selected, setSelected] = useState<string[]>([]);
  const [nextOnly, setNextOnly] = useState(false);

  const tags = document ? allTags(document) : [];
  // Only filter once at least one tag is chosen — an empty selection matches everything.
  const rows =
    document && selected.length > 0
      ? contextItems(document, selected, nextOnly).map((n) => toActionRow(document, n))
      : [];

  return (
    <TagFilterPanel
      allTags={tags}
      selected={selected}
      nextOnly={nextOnly}
      rows={rows}
      savedViews={document?.savedViews ?? []}
      onToggleTag={(tag) =>
        setSelected((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]))
      }
      onToggleNextOnly={() => setNextOnly((on) => !on)}
      onSetStatus={(id, status) => dispatch({ type: 'setStatus', id, status, now: nowIso() })}
      onEdit={openEditor}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
      onSaveView={() => {
        const name = window.prompt('Name this view')?.trim();
        if (name) dispatch({ type: 'createSavedView', name, tags: selected, nextOnly });
      }}
      onOpenView={(view) => {
        setSelected(view.tags);
        setNextOnly(view.nextOnly);
      }}
      onRenameView={(oldName) => {
        const newName = window.prompt('Rename view', oldName)?.trim();
        if (newName && newName !== oldName) dispatch({ type: 'renameSavedView', oldName, newName });
      }}
      onDeleteView={(name) => dispatch({ type: 'deleteSavedView', name })}
    />
  );
}
