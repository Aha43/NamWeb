import { Fragment, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeftRight, ChevronsRightLeft } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { ActionList, ActionRow } from '../actions/ActionRow';
import { StatusMenu } from '../actions/StatusMenu';
import { ReorderControls } from '../actions/ReorderControls';
import { SortableRow, type SortableRowRender } from '@/components/dnd/SortableRow';
import { COLUMN_DROPPABLE_PREFIX, columnDroppableId, resolveColumnDrop } from './columnDnd';

// With a DragOverlay the source row stays put, so rect-based detection (closestCorners) can't reach
// a distant column. Use the pointer instead, and prefer a row hit (precise insert) over the column
// shell (which means "append / drop into empty space").
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const rowHit = hits.find((h) => !String(h.id).startsWith(COLUMN_DROPPABLE_PREFIX));
  return rowHit ? [rowHit] : hits;
};
import type { ActionRowData } from '../actions/rows';
import type { NodeStatus } from '../../domain/types';

export interface WorkbenchColumn {
  /** The node whose direct actions this column holds (the project itself for Unsorted). */
  id: string;
  title: string;
  /** The leading column = the project's own direct actions. */
  isUnsorted: boolean;
  actions: ActionRowData[];
}

export interface ColumnViewProps {
  columns: WorkbenchColumn[];
  onOpenColumn: (id: string) => void;
  onAddAction: (columnId: string, title: string) => void;
  onMoveAction: (columnId: string, id: string, direction: 'up' | 'down') => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit: (id: string) => void;
  /** Inline delete (with confirm) for an action card. */
  onDelete?: (id: string) => void;
  onRename: (id: string, title: string) => void;
  /** Commit a drag: reorder within a column (from === to) or reparent between columns.
   *  `targetActionIds` is the target column's resulting action order (including the moved action). */
  onMoveActionToColumn?: (
    actionId: string,
    fromColumnId: string,
    toColumnId: string,
    targetActionIds: string[],
  ) => void;
  /** Mount drag-and-drop. Buttons + the editor's Move to… stay as fallbacks. */
  dndEnabled?: boolean;
  /** Reorder the columns themselves (i.e. the sub-projects) with left/right buttons. The Unsorted
   *  column is fixed first and is never moved. */
  onMoveColumn?: (columnId: string, direction: 'left' | 'right') => void;
  /** Collapsed column ids + toggle (persisted per-project by the page). */
  collapsed?: Set<string>;
  onToggleCollapse?: (id: string) => void;
}

/** Kanban-style columns: Unsorted (the project's own actions) + one per sub-project. Presentational.
 *  Columns can be collapsed to a narrow strip. On desktop, actions can be dragged within and between
 *  columns; the within-column buttons and the editor's Move to… stay as fallbacks. */
export function ColumnView({
  columns,
  onOpenColumn,
  onAddAction,
  onMoveAction,
  onSetStatus,
  onEdit,
  onDelete,
  onRename,
  onMoveActionToColumn,
  dndEnabled,
  onMoveColumn,
  collapsed,
  onToggleCollapse,
}: ColumnViewProps) {
  // Sub-project columns (everything but the fixed Unsorted column) — the ones that can be reordered.
  const subColumnIds = columns.filter((c) => !c.isUnsorted).map((c) => c.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const dnd = Boolean(dndEnabled && onMoveActionToColumn);

  // One row; `drag` is supplied when the row is rendered inside a SortableContext.
  const renderRow = (col: WorkbenchColumn, row: ActionRowData, index: number, drag?: SortableRowRender) => (
    <ActionRow
      row={row}
      dragRef={drag?.setNodeRef}
      dragStyle={drag?.style}
      onEdit={() => onEdit(row.id)}
      onDelete={onDelete && (() => onDelete(row.id))}
      onRename={(title) => onRename(row.id, title)}
      actions={
        <div className="flex items-center gap-1">
          {drag?.handle}
          <ReorderControls
            title={row.title}
            onUp={index > 0 ? () => onMoveAction(col.id, row.id, 'up') : undefined}
            onDown={index < col.actions.length - 1 ? () => onMoveAction(col.id, row.id, 'down') : undefined}
          />
          <StatusMenu
            status={row.status}
            title={row.title}
            onSetStatus={(status) => onSetStatus(row.id, status)}
          />
        </div>
      }
    />
  );

  // The body of a full (non-collapsed) column: header, action rows, quick-add.
  const columnBody = (col: WorkbenchColumn) => {
    const label = col.isUnsorted ? 'Unsorted' : col.title;
    const rows =
      col.actions.length > 0 ? (
        <ActionList>
          {col.actions.map((row, index) =>
            dnd ? (
              <SortableRow key={row.id} id={row.id} label={row.title}>
                {(drag) => renderRow(col, row, index, drag)}
              </SortableRow>
            ) : (
              <Fragment key={row.id}>{renderRow(col, row, index)}</Fragment>
            ),
          )}
        </ActionList>
      ) : null;

    return (
      <>
        <div className="flex items-center justify-between px-1">
          {col.isUnsorted ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Unsorted
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Open ${col.title}`}
              onClick={() => onOpenColumn(col.id)}
              className="flex min-w-0 items-center gap-1 truncate text-sm font-medium text-foreground hover:underline"
            >
              <span className="truncate">{col.title}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {onMoveColumn && !col.isUnsorted && (
              <>
                <button
                  type="button"
                  aria-label={`Move ${col.title} left`}
                  disabled={subColumnIds[0] === col.id}
                  onClick={() => onMoveColumn(col.id, 'left')}
                  className="rounded-sm text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${col.title} right`}
                  disabled={subColumnIds[subColumnIds.length - 1] === col.id}
                  onClick={() => onMoveColumn(col.id, 'right')}
                  className="rounded-sm text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <span className="text-xs text-muted-foreground">{col.actions.length}</span>
            {onToggleCollapse && (
              <button
                type="button"
                aria-label={`Collapse ${label}`}
                onClick={() => onToggleCollapse(col.id)}
                className="rounded-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronsRightLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {dnd && rows ? (
          <SortableContext items={col.actions.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            {rows}
          </SortableContext>
        ) : (
          rows
        )}

        <ColumnAdd label={label} onAdd={(title) => onAddAction(col.id, title)} />
      </>
    );
  };

  const renderColumn = (col: WorkbenchColumn) => {
    const label = col.isUnsorted ? 'Unsorted' : col.title;
    if (collapsed?.has(col.id) && onToggleCollapse) {
      return (
        <div
          key={col.id}
          className="flex w-10 shrink-0 flex-col items-center gap-2 rounded-lg border border-border bg-card/40 p-2"
        >
          <button
            type="button"
            aria-label={`Expand ${label}`}
            onClick={() => onToggleCollapse(col.id)}
            className="rounded-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronsLeftRight className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">{col.actions.length}</span>
          <span className="max-h-40 truncate text-xs text-muted-foreground [writing-mode:vertical-rl]">
            {label}
          </span>
        </div>
      );
    }
    const cardClass = 'flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-card/40 p-2';
    return dnd ? (
      <DroppableColumn key={col.id} columnId={col.id} className={cardClass}>
        {columnBody(col)}
      </DroppableColumn>
    ) : (
      <div key={col.id} className={cardClass}>
        {columnBody(col)}
      </div>
    );
  };

  const board = <div className="flex items-start gap-3 overflow-x-auto pb-2">{columns.map(renderColumn)}</div>;
  if (!dnd) return board;

  const activeRow = activeId
    ? columns.flatMap((c) => c.actions).find((a) => a.id === activeId)
    : null;

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const drop = resolveColumnDrop(
      columns.map((c) => ({ id: c.id, actionIds: c.actions.map((a) => a.id) })),
      String(active.id),
      String(over.id),
    );
    if (drop) onMoveActionToColumn!(drop.actionId, drop.fromColumnId, drop.toColumnId, drop.targetActionIds);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {board}
      <DragOverlay>
        {activeRow ? (
          <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">
            {activeRow.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** A column shell that is itself a drop target (so an action can be dropped into empty space). */
function DroppableColumn({
  columnId,
  className,
  children,
}: {
  columnId: string;
  className: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(columnId) });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'ring-2 ring-ring')}>
      {children}
    </div>
  );
}

function ColumnAdd({ label, onAdd }: { label: string; onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }
  return (
    <form onSubmit={submit}>
      <input
        aria-label={`Add action to ${label}`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add an action…"
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
      />
    </form>
  );
}
