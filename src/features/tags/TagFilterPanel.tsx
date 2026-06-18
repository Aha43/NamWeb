import { useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import { StatusMenu } from '../actions/StatusMenu';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { PromptButton } from '@/components/ui/prompt-button';
import { cn } from '@/lib/utils';
import type { ActionRowData } from '../actions/rows';
import type { NodeStatus, SavedView } from '../../domain/types';

export interface TagFilterPanelProps {
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
  onToggleNextOnly: () => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit?: (id: string) => void;
  /** Inline delete (with confirm) for a result action row. */
  onDeleteAction?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  /** Provided when the current selection can be saved as a view. */
  onSaveView?: (name: string) => void;
  onOpenView: (view: SavedView) => void;
  onRenameView?: (oldName: string, newName: string) => void;
  onDeleteView?: (name: string) => void;
}

/** Filter active actions by tags (AND), with saved views. Session-only selection. Presentational. */
export function TagFilterPanel({
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
  onToggleNextOnly,
  onSetStatus,
  onEdit,
  onDeleteAction,
  onRename,
  onSaveView,
  onOpenView,
  onRenameView,
  onDeleteView,
}: TagFilterPanelProps) {
  const selectedSet = new Set(selected);
  const [newTag, setNewTag] = useState('');
  // Manage (create / rename / delete) is collapsed by default so it's out of the way when filtering.
  const [manageOpen, setManageOpen] = useState(false);

  function submitAddTag(event: FormEvent) {
    event.preventDefault();
    const trimmed = newTag.trim();
    if (!trimmed || !onAddTag) return;
    onAddTag(trimmed);
    setNewTag('');
  }

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      {(onAddTag || onRenameTag || onDeleteTag) && (
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={manageOpen}
            onClick={() => setManageOpen((o) => !o)}
            className="flex items-center gap-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            {manageOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Manage tags
          </button>
          {manageOpen && (
            <>
              {onAddTag && (
                <form onSubmit={submitAddTag} className="flex gap-2">
                  <input
                    aria-label="Create tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Create a tag…"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-ring"
                  />
                  <Button type="submit">Add</Button>
                </form>
              )}
              {(onRenameTag || onDeleteTag) && allTags.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {allTags.map((tag) => (
                    <li key={tag} className="flex items-center gap-2 px-3 py-2">
                      <span className="flex-1 truncate text-sm text-foreground">{tag}</span>
                      {tagCounts && (
                        <span className="text-xs text-muted-foreground">{tagCounts[tag] ?? 0}</span>
                      )}
                      {onRenameTag && (
                        <PromptButton
                          aria-label={`Rename tag ${tag}`}
                          title="Rename"
                          label="New tag name"
                          initialValue={tag}
                          submitLabel="Rename"
                          onSubmit={(name) => onRenameTag(tag, name)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </PromptButton>
                      )}
                      {onDeleteTag && (
                        <ConfirmButton
                          aria-label={`Delete tag ${tag}`}
                          title="Delete"
                          message={
                            (tagCounts?.[tag] ?? 0) > 0
                              ? `Delete "${tag}" from ${tagCounts![tag]} item${tagCounts![tag] === 1 ? '' : 's'}? This cannot be undone.`
                              : `Remove "${tag}" from the tag list?`
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
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved views</p>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {savedViews.map((view) => (
              <li key={view.name} className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  aria-label={`Open view ${view.name}`}
                  onClick={() => onOpenView(view)}
                  className="flex-1 truncate text-left text-sm text-foreground hover:underline"
                >
                  {view.name}
                  {view.nextOnly && <span className="text-xs text-muted-foreground"> · next only</span>}
                </button>
                {onRenameView && (
                  <PromptButton
                    aria-label={`Rename view ${view.name}`}
                    title="Rename"
                    label="New view name"
                    initialValue={view.name}
                    submitLabel="Rename"
                    onSubmit={(name) => onRenameView(view.name, name)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </PromptButton>
                )}
                {onDeleteView && (
                  <button
                    type="button"
                    aria-label={`Delete view ${view.name}`}
                    onClick={() => onDeleteView(view.name)}
                    className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {allTags.length === 0 ? (
        <EmptyState>No tags yet.</EmptyState>
      ) : (
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
                  {tag}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={nextOnly} onChange={onToggleNextOnly} />
            Next only
          </label>

          {selected.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">Select one or more tags to filter.</p>
          ) : (
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>{rows.length} {rows.length === 1 ? 'match' : 'matches'}</span>
              {onSaveView && (
                <PromptButton
                  label="View name"
                  placeholder="Name this view…"
                  submitLabel="Save"
                  onSubmit={onSaveView}
                  className="rounded-md border border-input px-2.5 py-1 font-medium text-foreground hover:bg-accent"
                >
                  Save as view…
                </PromptButton>
              )}
            </div>
          )}

          {selected.length > 0 && rows.length > 0 && (
            <ActionList>
              {rows.map((row) => (
                <ActionRow
                  key={row.id}
                  row={row}
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
