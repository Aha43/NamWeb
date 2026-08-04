import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { allTags, applyViewOrder, contextItems, effectiveTags, mergeVisibleOrder } from '@/domain/lenses';
import { canonicalTag } from '@/domain/systemTags';
import type { NamNode } from '@/domain/types';
import { nowIso } from '@/lib/local';
import { toActionRow } from '@/features/actions/rows';
import { TagFilterPanel } from '@/features/tags/TagFilterPanel';
import { contextViewKey } from '@/features/tags/contextViewKey';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { AddBookmarkButton } from '@/features/bookmarks/AddBookmarkButton';
import { StatusFilterBoxes } from '@/features/actions/StatusFilterBoxes';
import { InProgressFilterToggle } from '@/features/actions/InProgressFilterToggle';
import { isInProgress } from '@/features/tags/inProgress';
import { type StatusBoxes } from '@/features/actions/statusBoxes';
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
  const isDesktop = useIsDesktop();
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
  // The bookmark view is about *doing*, so Next-only lands CHECKED by default — regardless of
  // how the bookmark was saved. Unchecking is a session tweak: it must survive the URL
  // round-trip, so the bookmark view writes `next` explicitly (1/0) instead of omit-means-off.
  const effectiveNextOnly = bookmark && !params.has('next') ? true : nextOnly;
  // The status boxes (#766): NEXT/BACKLOG defaults derive from the URL's nextOnly semantics
  // (so bookmarks/saved views/Focus keep their contract); DONE — and combos the URL can't
  // express (Backlog alone) — are session overrides, reset when the visit identity changes.
  const [boxOverride, setBoxOverride] = useState<Partial<StatusBoxes>>({});
  const [inProgressOnly, setInProgressOnly] = useState(false); // "in-progress only" filter (#968)
  // Overrides die with the visit they belonged to (#772/F4): any URL change this page did not
  // itself write — a saved view, a bookmark re-click, a Focus exit — is a fresh landing and
  // must not inherit a previous session's box state. setFilter records what it writes; the
  // effect resets on anything else.
  const selfWroteRef = useRef<string | null>(null);
  useEffect(() => {
    const now = params.toString();
    // A fresh landing (bookmark, saved view, Focus exit, external nav) resets the session filters —
    // the in-progress toggle rides along with boxOverride so it can't leak into the next context (P2).
    if (selfWroteRef.current !== now) {
      setBoxOverride({});
      setInProgressOnly(false);
    }
    selfWroteRef.current = null;
  }, [params]);
  const boxes: StatusBoxes = {
    NEXT: boxOverride.NEXT ?? true,
    BACKLOG: boxOverride.BACKLOG ?? !effectiveNextOnly,
    DONE: boxOverride.DONE ?? false,
  };
  const toggleBox = (k: keyof StatusBoxes) => {
    const next = { ...boxes, [k]: !boxes[k] };
    setBoxOverride((o) => ({ ...o, [k]: next[k] }));
    // Keep the URL's nextOnly truthful when the combo is representable — {Next} ↔ next=1,
    // {Next, Backlog} ↔ next=0 — so the star/save/Focus round-trips stay honest.
    if (k !== 'DONE') {
      if (next.NEXT && !next.BACKLOG) setFilter(selected, true);
      else if (next.NEXT && next.BACKLOG) setFilter(selected, false);
    }
  };
  const setFilter = (nextSelected: string[], nextNextOnly: boolean) => {
    const next = tagFilterParams(nextSelected, nextNextOnly);
    if (bookmark) {
      next.set('bm', bookmark.id); // a tweak stays inside the bookmark view
      next.set('next', nextNextOnly ? '1' : '0');
    }
    selfWroteRef.current = next.toString(); // our own write — overrides survive it (#772/F4)
    setParams(next, { replace: true });
  };

  const tags = document ? allTags(document) : [];
  const tagCounts: Record<string, number> = {};
  if (document) {
    // Count effective tags (own + inherited) so a rubbed-off project tag is reflected on every
    // descendant, matching how filtering already treats it.
    for (const node of Object.values(document.nodes)) {
      // Key by the CANONICAL identity so a legacy `in progress` node counts under its
      // canonical `#in-progress` row (allTags canonicalizes too) — not a phantom raw row (#844/#4).
      for (const t of effectiveTags(document, node.id)) {
        const c = canonicalTag(t);
        tagCounts[c] = (tagCounts[c] ?? 0) + 1;
      }
    }
  }
  // Persistent manual order per context (#1036). The FULL ordering domain is every context item
  // across all statuses — independent of the status boxes / in-progress filter, so a hand-sorted
  // order stays put as you toggle those. `applyViewOrder` lays the saved order first, unordered
  // items at the bottom. Only meaningful once at least one tag is chosen.
  const viewKey = contextViewKey(selected);
  const allContext: NamNode[] =
    document && selected.length > 0
      ? applyViewOrder(contextItems(document, selected, false, true), document.viewOrders[viewKey])
      : [];
  // Visible = the boxes + in-progress filter applied, preserving the ordered sequence.
  const contextNodes = allContext.filter((n) =>
    n.status === 'NEXT' || n.status === 'BACKLOG' || n.status === 'DONE' ? boxes[n.status] : true,
  );
  const hasInProgress = contextNodes.some(isInProgress);
  const shown = inProgressOnly ? contextNodes.filter(isInProgress) : contextNodes;
  const rows = document ? shown.map((n) => toActionRow(document, n)) : [];
  // Persist a drag: merge the reordered VISIBLE ids back into the full context order, so reordering
  // while a filter hides rows never strands the hidden ones (#968-style; #1036).
  const reorderContext = (ids: string[]) =>
    dispatch({ type: 'reorderView', view: viewKey, order: mergeVisibleOrder(allContext, ids) });

  return (
    <TagFilterPanel
      allTags={tags}
      selected={selected}
      nextOnly={effectiveNextOnly}
      onReorder={reorderContext}
      dndEnabled={isDesktop}
      rows={rows}
      savedViews={bookmark ? [] : (document?.savedViews ?? [])}
      onToggleTag={(tag) =>
        // effectiveNextOnly, not the raw parse (#750/F1): in the bookmark view a chip toggle
        // must not silently release the forced Next-only.
        setFilter(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag], effectiveNextOnly)
      }
      title={bookmark?.label}
      collapseSelection={Boolean(bookmark)}
      onAddTag={bookmark ? undefined : (tag) => dispatch({ type: 'registerTag', tag })}
      tagCounts={tagCounts}
      onRenameTag={bookmark ? undefined : (tag, newName) => {
        const norm = newName.trim().toLowerCase();
        if (norm && norm !== tag) {
          dispatch({ type: 'renameTag', from: tag, to: norm });
          setFilter(selected.map((t) => (t === tag ? norm : t)), effectiveNextOnly);
        }
      }}
      onDeleteTag={bookmark ? undefined : (tag) => {
        dispatch({ type: 'deleteTag', tag });
        setFilter(selected.filter((t) => t !== tag), effectiveNextOnly);
      }}
      statusBoxesSlot={
        <div className="flex items-center gap-1.5">
          <StatusFilterBoxes boxes={boxes} onToggle={toggleBox} />
          {(hasInProgress || inProgressOnly) && (
            <InProgressFilterToggle active={inProgressOnly} onToggle={() => setInProgressOnly((v) => !v)} />
          )}
        </div>
      }
      onSetStatus={setStatus}
      onEdit={openEditor}
      onDeleteAction={deleteNode}
      onRename={(id, title) => {
        const node = document?.nodes[id];
        if (node) dispatch({ type: 'updateNode', id, title, description: node.description, now: nowIso() });
      }}
      onSaveView={bookmark ? undefined : (name) => dispatch({ type: 'createSavedView', name, tags: selected, nextOnly: effectiveNextOnly })}
      onFocus={() => {
        const search = tagFilterParams(selected, effectiveNextOnly);
        if (bookmark) search.set('bm', bookmark.id); // the deck's exit comes home to the bookmark view (#750/F2)
        if (inProgressOnly) search.set('inProgress', '1'); // the filter travels into the deck (P1-a)
        navigate({ pathname: '/focus', search: search.toString() });
      }}
      onOpenView={(view) => {
        setBoxOverride({}); // a saved view is a fresh landing — its nextOnly must win (#772/F4)
        setInProgressOnly(false); // …and it must not inherit the previous view's in-progress filter (P2)
        setFilter(view.tags, view.nextOnly);
      }}
      onRenameView={(oldName, newName) => {
        if (newName !== oldName) dispatch({ type: 'renameSavedView', oldName, newName });
      }}
      onDeleteView={(name) => dispatch({ type: 'deleteSavedView', name })}
      bookmarkSlot={
        selected.length > 0 ? (
          <AddBookmarkButton
            draft={{ kind: 'tagFilter', tags: selected, nextOnly: effectiveNextOnly, label: `#${selected.join(' #')}` }}
            // Standing inside a bookmark's own view, the star is that bookmark (#750/F3) — the
            // forced Next-only must not make it read "not bookmarked" and mint near-duplicates.
            existingId={bookmark?.id}
          />
        ) : undefined
      }
    />
  );
}
