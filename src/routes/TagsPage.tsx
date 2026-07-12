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
import { useSetStatus } from '@/features/actions/useSetStatus';
import { useWorkspaceContext } from '@/store/workspace-context';
import { bookmarksOf } from '@/features/bookmarks/bookmarks';

export function TagsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const navigate = useNavigate();
  const deleteNode = useDeleteNode();
  const setStatus = useSetStatus();
  // The filter lives in the URL so it survives the round-trip into Focus and back.
  const [params, setParams] = useSearchParams();
  const { selected, nextOnly } = useMemo(() => parseTagFilter(params), [params]);
  // Arrived via a context bookmark (#745): its id rides the URL (`bm`), and the page renders the
  // bookmark view — the label as title, the workshop chrome (manage/saved views) tucked away,
  // the selection collapsed. Tweaks stay session-local (the URL); the bookmark isn't rewritten.
  const bmId = params.get('bm');
  const bookmark = useMemo(() => {
    if (!bmId || !document) return undefined;
    return bookmarksOf(document).find((b) => b.id === bmId && b.kind === 'tagFilter');
  }, [bmId, document]);
  const setFilter = (nextSelected: string[], nextNextOnly: boolean) => {
    const next = tagFilterParams(nextSelected, nextNextOnly);
    if (bookmark) next.set('bm', bookmark.id); // a tweak stays inside the bookmark view
    setParams(next, { replace: true });
  };

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
      savedViews={bookmark ? [] : (document?.savedViews ?? [])}
      onToggleTag={(tag) =>
        setFilter(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag], nextOnly)
      }
      title={bookmark?.label}
      collapseSelection={Boolean(bookmark)}
      onAddTag={bookmark ? undefined : (tag) => dispatch({ type: 'registerTag', tag })}
      tagCounts={tagCounts}
      onRenameTag={bookmark ? undefined : (tag, newName) => {
        const norm = newName.trim().toLowerCase();
        if (norm && norm !== tag) {
          dispatch({ type: 'renameTag', from: tag, to: norm });
          setFilter(selected.map((t) => (t === tag ? norm : t)), nextOnly);
        }
      }}
      onDeleteTag={bookmark ? undefined : (tag) => {
        dispatch({ type: 'deleteTag', tag });
        setFilter(selected.filter((t) => t !== tag), nextOnly);
      }}
      onToggleNextOnly={() => setFilter(selected, !nextOnly)}
      onSetStatus={setStatus}
      onEdit={openEditor}
      onDeleteAction={deleteNode}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
      onSaveView={bookmark ? undefined : (name) => dispatch({ type: 'createSavedView', name, tags: selected, nextOnly })}
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
