import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { allTags, contextItems, effectiveTags } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { TagFilterPanel } from '@/features/tags/TagFilterPanel';
import { AddBookmarkButton } from '@/features/bookmarks/AddBookmarkButton';
import { tagFilterParams, parseTagFilter } from '@/features/tags/tagFilterParams';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useWorkspaceContext } from '@/store/workspace-context';

export function TagsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const navigate = useNavigate();
  const deleteNode = useDeleteNode();
  // The filter lives in the URL so it survives the round-trip into Focus and back.
  const [params, setParams] = useSearchParams();
  const { selected, nextOnly } = useMemo(() => parseTagFilter(params), [params]);
  const setFilter = (nextSelected: string[], nextNextOnly: boolean) =>
    setParams(tagFilterParams(nextSelected, nextNextOnly), { replace: true });

  const tags = document ? allTags(document) : [];
  const tagCounts: Record<string, number> = {};
  if (document) {
    // Count effective tags (own + inherited) so a rubbed-off project tag is reflected on every
    // descendant, matching how filtering already treats it.
    for (const node of Object.values(document.nodes)) {
      for (const t of effectiveTags(document, node.id)) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
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
        setFilter(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag], nextOnly)
      }
      onAddTag={(tag) => dispatch({ type: 'registerTag', tag })}
      tagCounts={tagCounts}
      onRenameTag={(tag, newName) => {
        const norm = newName.trim().toLowerCase();
        if (norm && norm !== tag) {
          dispatch({ type: 'renameTag', from: tag, to: norm });
          setFilter(selected.map((t) => (t === tag ? norm : t)), nextOnly);
        }
      }}
      onDeleteTag={(tag) => {
        dispatch({ type: 'deleteTag', tag });
        setFilter(selected.filter((t) => t !== tag), nextOnly);
      }}
      onToggleNextOnly={() => setFilter(selected, !nextOnly)}
      onSetStatus={(id, status) => dispatch({ type: 'setStatus', id, status, now: nowIso() })}
      onEdit={openEditor}
      onDeleteAction={deleteNode}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
      onSaveView={(name) => dispatch({ type: 'createSavedView', name, tags: selected, nextOnly })}
      onFocus={() =>
        navigate({ pathname: '/focus', search: tagFilterParams(selected, nextOnly).toString() })
      }
      onOpenView={(view) => setFilter(view.tags, view.nextOnly)}
      onRenameView={(oldName, newName) => {
        if (newName !== oldName) dispatch({ type: 'renameSavedView', oldName, newName });
      }}
      onDeleteView={(name) => dispatch({ type: 'deleteSavedView', name })}
      bookmarkSlot={
        selected.length > 0 ? (
          <AddBookmarkButton
            draft={{ kind: 'tagFilter', tags: selected, nextOnly, label: `#${selected.join(' #')}` }}
          />
        ) : undefined
      }
    />
  );
}
