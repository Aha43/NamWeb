// Pure drag-drop math for the Column/Kanban view (phase 6b). Kept out of the component so the
// "where does the action land" logic is unit-testable without simulating dnd-kit.

/** Prefix for a column's droppable id, so it never collides with an action's node id. */
export const COLUMN_DROPPABLE_PREFIX = 'col:';

export const columnDroppableId = (columnId: string): string => `${COLUMN_DROPPABLE_PREFIX}${columnId}`;

export interface ColumnActions {
  id: string;
  /** The column's action ids, in display order. */
  actionIds: string[];
}

export interface ColumnDrop {
  actionId: string;
  fromColumnId: string;
  toColumnId: string;
  /** The target column's resulting action order (including the moved action). */
  targetActionIds: string[];
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Resolve a drag (active action `activeId` dropped over `overId`) into the column move it implies.
 * `overId` is either an action id (dropped onto a row) or a `col:<id>` droppable (dropped onto a
 * column's empty space → append). Returns `null` for a no-op or an unresolvable drop.
 */
export function resolveColumnDrop(
  columns: ColumnActions[],
  activeId: string,
  overId: string,
): ColumnDrop | null {
  const fromColumn = columns.find((c) => c.actionIds.includes(activeId));
  if (!fromColumn) return null;

  const overColumnId = overId.startsWith(COLUMN_DROPPABLE_PREFIX)
    ? overId.slice(COLUMN_DROPPABLE_PREFIX.length)
    : columns.find((c) => c.actionIds.includes(overId))?.id;
  if (!overColumnId) return null;
  const overActionId = overId.startsWith(COLUMN_DROPPABLE_PREFIX) ? null : overId;

  if (fromColumn.id === overColumnId) {
    const ids = fromColumn.actionIds;
    const from = ids.indexOf(activeId);
    const to = overActionId ? ids.indexOf(overActionId) : ids.length - 1;
    if (from === to || to < 0) return null;
    return { actionId: activeId, fromColumnId: fromColumn.id, toColumnId: overColumnId, targetActionIds: move(ids, from, to) };
  }

  const target = columns.find((c) => c.id === overColumnId);
  if (!target) return null;
  const insertAt = overActionId ? target.actionIds.indexOf(overActionId) : target.actionIds.length;
  const targetActionIds = [
    ...target.actionIds.slice(0, insertAt),
    activeId,
    ...target.actionIds.slice(insertAt),
  ];
  return { actionId: activeId, fromColumnId: fromColumn.id, toColumnId: overColumnId, targetActionIds };
}
