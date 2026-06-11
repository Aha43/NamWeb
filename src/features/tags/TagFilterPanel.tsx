import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import { StatusMenu } from '../actions/StatusMenu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ActionRowData } from '../actions/rows';
import type { NodeStatus } from '../../domain/types';

export interface TagFilterPanelProps {
  allTags: string[];
  selected: string[];
  rows: ActionRowData[];
  onToggleTag: (tag: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  /** Provided when the current selection can be saved as a view. */
  onSaveView?: () => void;
}

/** Filter active actions by tags (AND). Session-only selection. Presentational. */
export function TagFilterPanel({
  allTags,
  selected,
  rows,
  onToggleTag,
  onSetStatus,
  onEdit,
  onRename,
  onSaveView,
}: TagFilterPanelProps) {
  const selectedSet = new Set(selected);
  return (
    <section className="mx-auto max-w-md space-y-4">
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

          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>{rows.length} {rows.length === 1 ? 'match' : 'matches'}</span>
            {onSaveView && selected.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={onSaveView}>
                Save as view…
              </Button>
            )}
          </div>

          {rows.length > 0 && (
            <ActionList>
              {rows.map((row) => (
                <ActionRow
                  key={row.id}
                  row={row}
                  onEdit={onEdit && (() => onEdit(row.id))}
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
