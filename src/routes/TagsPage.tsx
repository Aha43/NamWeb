import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { allTags, contextItems } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { TagFilterPanel } from '@/features/tags/TagFilterPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useWorkspaceContext } from '@/store/workspace-context';

export function TagsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const navigate = useNavigate();
  const deleteNode = useDeleteNode();
  const [selected, setSelected] = useState<string[]>([]);
  const [nextOnly, setNextOnly] = useState(false);

  const tags = document ? allTags(document) : [];
  const tagCounts: Record<string, number> = {};
  if (document) {
    for (const node of Object.values(document.nodes)) {
      for (const t of node.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }
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
      onAddTag={(tag) => dispatch({ type: 'registerTag', tag })}
      tagCounts={tagCounts}
      onRenameTag={(tag, newName) => {
        const norm = newName.trim().toLowerCase();
        if (norm && norm !== tag) {
          dispatch({ type: 'renameTag', from: tag, to: norm });
          setSelected((cur) => cur.map((t) => (t === tag ? norm : t)));
        }
      }}
      onDeleteTag={(tag) => {
        dispatch({ type: 'deleteTag', tag });
        setSelected((cur) => cur.filter((t) => t !== tag));
      }}
      onToggleNextOnly={() => setNextOnly((on) => !on)}
      onSetStatus={(id, status) => dispatch({ type: 'setStatus', id, status, now: nowIso() })}
      onEdit={openEditor}
      onDeleteAction={deleteNode}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
      onSaveView={(name) => dispatch({ type: 'createSavedView', name, tags: selected, nextOnly })}
      onFocus={() =>
        navigate(`/focus?tags=${selected.map(encodeURIComponent).join(',')}${nextOnly ? '&next=1' : ''}`)
      }
      onOpenView={(view) => {
        setSelected(view.tags);
        setNextOnly(view.nextOnly);
      }}
      onRenameView={(oldName, newName) => {
        if (newName !== oldName) dispatch({ type: 'renameSavedView', oldName, newName });
      }}
      onDeleteView={(name) => dispatch({ type: 'deleteSavedView', name })}
    />
  );
}
