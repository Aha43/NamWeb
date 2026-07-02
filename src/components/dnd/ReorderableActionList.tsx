import { Fragment, type ReactNode } from 'react';
import { ActionList, ActionRow } from '@/features/actions/ActionRow';
import type { ActionRowData } from '@/features/actions/rows';
import { SortableList } from './SortableList';
import { SortableRow } from './SortableRow';

export interface ReorderableActionListProps {
  rows: ActionRowData[];
  /** Trailing controls for a row (status menu, up/down buttons, …). The drag handle is prepended
   *  automatically when drag is enabled — don't include it here. */
  renderActions: (row: ActionRowData, index: number) => ReactNode;
  onEdit?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  /** Delete a row inline (the caller confirms). Renders a trailing trash button. */
  onDelete?: (id: string) => void;
  /** Commit a drag reorder (the full new id order). */
  onReorder?: (ids: string[]) => void;
  /** Mount drag-and-drop (desktop). When false, rows render with their buttons only. */
  dndEnabled?: boolean;
  /** When provided, rows show a selection checkbox (multi-select). */
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** Tint titles by status (passed to ActionRow). Off for single-status lists. Default on. */
  colorByStatus?: boolean;
}

/** An {@link ActionList} of {@link ActionRow}s that can be drag-reordered on desktop, with the
 *  caller's own per-row controls. Buttons (supplied via `renderActions`) stay the a11y fallback. */
export function ReorderableActionList({
  rows,
  renderActions,
  onEdit,
  onRename,
  onDelete,
  onReorder,
  dndEnabled,
  selectedIds,
  onToggleSelect,
  colorByStatus = true,
}: ReorderableActionListProps) {
  // Mirror SortableList's gate: no drag (and no SortableRow) unless there are 2+ items to reorder.
  const dnd = Boolean(dndEnabled && onReorder && rows.length > 1);
  const selectable = Boolean(onToggleSelect);

  const row = (data: ActionRowData, index: number) =>
    dnd ? (
      <SortableRow key={data.id} id={data.id} label={data.title}>
        {(drag) => (
          <ActionRow
            row={data}
            colorByStatus={colorByStatus}
            dragRef={drag.setNodeRef}
            dragStyle={drag.style}
            onEdit={onEdit && (() => onEdit(data.id))}
            onDelete={onDelete && (() => onDelete(data.id))}
            onRename={onRename && ((title) => onRename(data.id, title))}
            selectable={selectable}
            selected={selectedIds?.has(data.id) ?? false}
            onSelectedChange={onToggleSelect && (() => onToggleSelect(data.id))}
            actions={
              <div className="flex items-center gap-1">
                {drag.handle}
                {renderActions(data, index)}
              </div>
            }
          />
        )}
      </SortableRow>
    ) : (
      <Fragment key={data.id}>
        <ActionRow
          row={data}
          colorByStatus={colorByStatus}
          onEdit={onEdit && (() => onEdit(data.id))}
          onDelete={onDelete && (() => onDelete(data.id))}
          onRename={onRename && ((title) => onRename(data.id, title))}
          selectable={selectable}
          selected={selectedIds?.has(data.id) ?? false}
          onSelectedChange={onToggleSelect && (() => onToggleSelect(data.id))}
          actions={<div className="flex items-center gap-1">{renderActions(data, index)}</div>}
        />
      </Fragment>
    );

  return (
    <SortableList ids={rows.map((r) => r.id)} onReorder={onReorder ?? (() => {})} disabled={!dnd}>
      <ActionList>{rows.map(row)}</ActionList>
    </SortableList>
  );
}
