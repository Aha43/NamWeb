import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Pencil, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import { StatusMenu } from '../actions/StatusMenu';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { PromptButton } from '@/components/ui/prompt-button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isSystemTag } from '@/domain/systemTags';
import type { ActionRowData } from '../actions/rows';
import type { NodeStatus, SavedView } from '../../domain/types';

export interface TagFilterPanelProps {
  /** Bookmark-view title (#745): set when the page landed via a context bookmark. */
  title?: string;
  /** Start with the tag-chip selection collapsed to a dense line (#745) — tweaking stays a
   *  click away, but the view leads with the actions. */
  collapseSelection?: boolean;
  allTags: string[];
  selected: string[];
  nextOnly: boolean;
  rows: ActionRowData[];
  savedViews: SavedView[];
  onToggleTag: (tag: string) => void;
  /** Create a standalone tag (without having to tag an item first). */
  onAddTag?: (tag: string) => void;
  /** Per-tag usage counts (how many items carry each tag). */
  tagCounts?: Record<string, number>;
  /** Rename a tag everywhere it's used (new name from the inline prompt). */
  onRenameTag?: (tag: string, newName: string) => void;
  /** Delete a tag (from the list and every item using it). */
  onDeleteTag?: (tag: string) => void;
  /** Superseded by statusBoxesSlot (#766); kept optional for compat. */
  onToggleNextOnly?: () => void;
  /** The status include-boxes (#766) — rendered where the old Next-only checkbox sat. */
  statusBoxesSlot?: ReactNode;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit?: (id: string) => void;
  /** Inline delete (with confirm) for a result action row. */
  onDeleteAction?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  /** Provided when the current selection can be saved as a view. */
  onSaveView?: (name: string) => void;
  /** Enter Focus mode over the currently-filtered actions (the Tags-view "Focus" button). */
  onFocus?: () => void;
  onOpenView: (view: SavedView) => void;
  onRenameView?: (oldName: string, newName: string) => void;
  onDeleteView?: (name: string) => void;
  /** Optional control (e.g. the bookmark toggle) shown beside Focus/Save when a filter is active. */
  bookmarkSlot?: ReactNode;
}

/** Filter active actions by tags (AND), with saved views. Session-only selection. Presentational. */
export function TagFilterPanel({
  title,
  collapseSelection = false,
  allTags,
  selected,
  nextOnly,
  rows,
  savedViews,
  onToggleTag,
  onAddTag,
  tagCounts,
  onRenameTag,
  onDeleteTag,
  statusBoxesSlot,
  onSetStatus,
  onEdit,
  onDeleteAction,
  onRename,
  onSaveView,
  onFocus,
  onOpenView,
  onRenameView,
  onDeleteView,
  bookmarkSlot,
}: TagFilterPanelProps) {
  const { t } = useTranslation();
  const selectedSet = new Set(selected);
  const [newTag, setNewTag] = useState('');
  // Manage (create / rename / delete) is collapsed by default so it's out of the way when filtering.
  const [manageOpen, setManageOpen] = useState(false);
  // The bookmark view leads with the actions; the chips open on demand (#745).
  const [selectionOpen, setSelectionOpen] = useState(!collapseSelection);
  // If the collapse mode leaves mid-session (the bookmark deleted remotely → workshop mode),
  // the expander disappears — the chips must not stay hidden with no way back (#750).
  useEffect(() => {
    if (!collapseSelection) setSelectionOpen(true);
  }, [collapseSelection]);

  function submitAddTag(event: FormEvent) {
    event.preventDefault();
    const trimmed = newTag.trim();
    if (!trimmed || !onAddTag) return;
    onAddTag(trimmed);
    setNewTag('');
  }

  return (
    <section className="space-y-4">
      {title && <h2 className="truncate px-1 text-lg font-semibold tracking-tight">{title}</h2>}
      {(onAddTag || onRenameTag || onDeleteTag) && (
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={manageOpen}
            onClick={() => setManageOpen((o) => !o)}
            className="flex items-center gap-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            {manageOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {t('tags.manage')}
          </button>
          {manageOpen && (
            <>
              {onAddTag && (
                <form onSubmit={submitAddTag} className="flex gap-2">
                  <input
                    aria-label={t('tags.createAria')}
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder={t('tags.createPlaceholder')}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
                  />
                  <Button type="submit">{t('common.add')}</Button>
                </form>
              )}
              {(onRenameTag || onDeleteTag) && allTags.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {allTags.map((tag) => (
                    <li key={tag} className="flex items-center gap-2 px-3 py-2">
                      <span className={cn('flex-1 truncate text-sm text-foreground', isSystemTag(tag) && 'font-semibold')}>
                        {tag}
                      </span>
                      {tagCounts && (
                        <span className="text-xs text-muted-foreground">{tagCounts[tag] ?? 0}</span>
                      )}
                      {/* System tags are part of the app — no rename/delete (#651). */}
                      {onRenameTag && !isSystemTag(tag) && (
                        <PromptButton
                          aria-label={t('tags.renameTagAria', { tag })}
                          label={t('tags.newTagName')}
                          initialValue={tag}
                          submitLabel={t('common.rename')}
                          onSubmit={(name) => onRenameTag(tag, name)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </PromptButton>
                      )}
                      {onDeleteTag && !isSystemTag(tag) && (
                        <ConfirmButton
                          aria-label={t('tags.deleteTagAria', { tag })}
                          message={
                            (tagCounts?.[tag] ?? 0) > 0
                              ? t('tags.deleteTagConfirm', { tag, count: tagCounts![tag] })
                              : t('tags.removeTagConfirm', { tag })
                          }
                          onConfirm={() => onDeleteTag(tag)}
                          className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </ConfirmButton>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
      {savedViews.length > 0 && (
        <div className="space-y-1">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('tags.savedViews')}</p>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {savedViews.map((view) => (
              <li key={view.name} className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  aria-label={t('tags.openViewAria', { name: view.name })}
                  onClick={() => onOpenView(view)}
                  className="flex-1 truncate text-left text-sm text-foreground hover:underline"
                >
                  {view.name}
                  {view.nextOnly && <span className="text-xs text-muted-foreground">{t('tags.nextOnlySuffix')}</span>}
                </button>
                {onRenameView && (
                  <PromptButton
                    aria-label={t('tags.renameViewAria', { name: view.name })}
                    label={t('tags.newViewName')}
                    initialValue={view.name}
                    submitLabel={t('common.rename')}
                    onSubmit={(name) => onRenameView(view.name, name)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </PromptButton>
                )}
                {onDeleteView && (
                  <Tooltip label={t('tags.deleteViewAria', { name: view.name })}>
                    <button
                      type="button"
                      aria-label={t('tags.deleteViewAria', { name: view.name })}
                      onClick={() => onDeleteView(view.name)}
                      className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </Tooltip>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {allTags.length === 0 ? (
        <EmptyState hint={t('tags.emptyHint')}>{t('tags.emptyTitle')}</EmptyState>
      ) : (
        <>
          {collapseSelection && (
            /* The dense truth of the selection doubles as the expander (#745): the tags you
               came for readable at a glance, adjustable one click deeper. Next-only sits
               OUTSIDE the collapse — it's a doing-lever, not a tag tweak — beside the line. */
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                aria-expanded={selectionOpen}
                aria-label={t('tags.adjustSelectionAria')}
                onClick={() => setSelectionOpen((o) => !o)}
                className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {selectionOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {selected.join(', ')}
              </button>
              {statusBoxesSlot}
            </div>
          )}
          {selectionOpen && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const on = selectedSet.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onToggleTag(tag)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        on
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <span className={cn(isSystemTag(tag) && 'font-bold')}>{tag}</span>
                    </button>
                  );
                })}
              </div>

              {!collapseSelection && statusBoxesSlot}
            </>
          )}

          {selected.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              {t('tags.filterHintBefore')}{' '}
              <span className="font-medium text-foreground">{t('domain.focus')}</span>{' '}
              {t('tags.filterHintAfter')}
            </p>
          ) : (
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>{t('tags.matchCount', { count: rows.length })}</span>
              <div className="flex items-center gap-1.5">
                {bookmarkSlot}
                {onFocus && rows.length > 0 && (
                  <button
                    type="button"
                    onClick={onFocus}
                    className="flex items-center gap-1 rounded-md border border-input px-2.5 py-1 font-medium text-foreground hover:bg-accent"
                  >
                    <Target className="h-3.5 w-3.5 focus-glow" />
                    {t('domain.focus')}
                  </button>
                )}
                {onSaveView && (
                  <PromptButton
                    label={t('tags.viewName')}
                    placeholder={t('tags.nameView')}
                    submitLabel={t('common.save')}
                    onSubmit={onSaveView}
                    className="rounded-md border border-input px-2.5 py-1 font-medium text-foreground hover:bg-accent"
                  >
                    {t('tags.saveAsView')}
                  </PromptButton>
                )}
              </div>
            </div>
          )}

          {selected.length > 0 && rows.length > 0 && (
            <ActionList>
              {rows.map((row) => (
                <ActionRow
                  key={row.id}
                  row={row}
                  colorByStatus={!nextOnly} // next-only = all NEXT; otherwise the list mixes statuses
                  onEdit={onEdit && (() => onEdit(row.id))}
                  onDelete={onDeleteAction && (() => onDeleteAction(row.id))}
                  onRename={onRename && ((title) => onRename(row.id, title))}
                  actions={
                    <StatusMenu
                      status={row.status}
                      title={row.title}
                      onSetStatus={(status) => onSetStatus(row.id, status)}
                    />
                  }
                />
              ))}
            </ActionList>
          )}
        </>
      )}
    </section>
  );
}
