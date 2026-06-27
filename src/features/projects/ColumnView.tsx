import { Fragment, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeftRight, ChevronsRightLeft, Pencil } from 'lucide-react';
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
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { ActionRow } from '../actions/ActionRow';
import { InlineRename } from '../actions/InlineRename';
import { StatusMenu } from '../actions/StatusMenu';
import { ReorderControls } from '../actions/ReorderControls';
import { SortableRow, type SortableRowRender } from '@/components/dnd/SortableRow';
import { COLUMN_DROPPABLE_PREFIX, columnDroppableId, resolveColumnDrop } from './columnDnd';
import { DEFAULT_COLUMN_WIDTH } from './useColumnWidths';

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
  /** When cards are sorted by due date, suppress within-column card reorder (the up/down buttons and
   *  card drag) — the order is computed, not manual. Column reorder/collapse/resize stay available. */
  dueSorted?: boolean;
  /** Reorder the columns themselves (i.e. the sub-projects) with left/right buttons. The Unsorted
   *  column is fixed first and is never moved. */
  onMoveColumn?: (columnId: string, direction: 'left' | 'right') => void;
  /** Collapsed column ids + toggle (persisted per-project by the page). */
  collapsed?: Set<string>;
  onToggleCollapse?: (id: string) => void;
  /** Per-column widths (px) + setters (persisted per-project by the page). When wired, each column
   *  gets a drag-to-resize handle on its right edge. A column with no entry uses the default width. */
  columnWidths?: Record<string, number>;
  onSetColumnWidth?: (id: string, width: number) => void;
  onResetColumnWidth?: (id: string) => void;
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
  dueSorted,
  onMoveColumn,
  collapsed,
  onToggleCollapse,
  columnWidths,
  onSetColumnWidth,
  onResetColumnWidth,
}: ColumnViewProps) {
  // Sub-project columns (everything but the fixed Unsorted column) — the ones that can be reordered.
  const subColumnIds = columns.filter((c) => !c.isUnsorted).map((c) => c.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [renamingColId, setRenamingColId] = useState<string | null>(null);
  // While sorted by due, the card order is computed — no manual drag or up/down within a column.
  const dnd = Boolean(dndEnabled && onMoveActionToColumn && !dueSorted);

  // One row; `drag` is supplied when the row is rendered inside a SortableContext.
  const renderRow = (col: WorkbenchColumn, row: ActionRowData, index: number, drag?: SortableRowRender) => (
    <ActionRow
      row={row}
      variant="card"
      dragRef={drag?.setNodeRef}
      dragStyle={drag?.style}
      onEdit={() => onEdit(row.id)}
      onDelete={onDelete && (() => onDelete(row.id))}
      onRename={(title) => onRename(row.id, title)}
      actions={
        <div className="flex items-center gap-1">
          {drag?.handle}
          {!dueSorted && (
            <ReorderControls
              title={row.title}
              onUp={index > 0 ? () => onMoveAction(col.id, row.id, 'up') : undefined}
              onDown={index < col.actions.length - 1 ? () => onMoveAction(col.id, row.id, 'down') : undefined}
            />
          )}
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
        <ul className="flex flex-col gap-1.5">
          {col.actions.map((row, index) =>
            dnd ? (
              <SortableRow key={row.id} id={row.id} label={row.title}>
                {(drag) => renderRow(col, row, index, drag)}
              </SortableRow>
            ) : (
              <Fragment key={row.id}>{renderRow(col, row, index)}</Fragment>
            ),
          )}
        </ul>
      ) : null;

    return (
      <>
        <div className="flex items-center justify-between px-1">
          {col.isUnsorted ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Unsorted
            </span>
          ) : renamingColId === col.id ? (
            <div className="min-w-0 flex-1 pr-1">
              <InlineRename
                title={col.title}
                onCommit={(t) => { onRename(col.id, t); setRenamingColId(null); }}
                onCancel={() => setRenamingColId(null)}
              />
            </div>
          ) : (
            <button
              type="button"
              aria-label={`Open ${col.title}`}
              onClick={() => onOpenColumn(col.id)}
              className="flex min-w-0 items-center gap-1 text-sm font-medium text-foreground hover:underline"
            >
              <TruncatedTitle text={col.title} className="min-w-0 flex-1 text-left" />
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {!col.isUnsorted && renamingColId !== col.id && (
              <Tooltip label={`Rename ${col.title}`}>
                <button
                  type="button"
                  aria-label={`Rename ${col.title}`}
                  onClick={() => setRenamingColId(col.id)}
                  className="rounded-sm text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )}
            {onMoveColumn && !col.isUnsorted && (
              <>
                <Tooltip label="Move column left">
                  <button
                    type="button"
                    aria-label={`Move ${col.title} left`}
                    disabled={subColumnIds[0] === col.id}
                    onClick={() => onMoveColumn(col.id, 'left')}
                    className="rounded-sm text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </Tooltip>
                <Tooltip label="Move column right">
                  <button
                    type="button"
                    aria-label={`Move ${col.title} right`}
                    disabled={subColumnIds[subColumnIds.length - 1] === col.id}
                    onClick={() => onMoveColumn(col.id, 'right')}
                    className="rounded-sm text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </Tooltip>
              </>
            )}
            <span className="text-xs text-muted-foreground">{col.actions.length}</span>
            {onToggleCollapse && (
              <Tooltip label="Collapse column">
                <button
                  type="button"
                  aria-label={`Collapse ${label}`}
                  onClick={() => onToggleCollapse(col.id)}
                  className="rounded-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronsRightLeft className="h-4 w-4" />
                </button>
              </Tooltip>
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
          <Tooltip label={`Expand ${label}`} side="right">
            <button
              type="button"
              aria-label={`Expand ${label}`}
              onClick={() => onToggleCollapse(col.id)}
              className="rounded-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronsLeftRight className="h-4 w-4" />
            </button>
          </Tooltip>
          <span className="text-xs text-muted-foreground">{col.actions.length}</span>
          <span className="max-h-40 truncate text-xs text-muted-foreground [writing-mode:vertical-rl]">
            {label}
          </span>
        </div>
      );
    }
    const cardClass = 'relative flex shrink-0 flex-col gap-2 rounded-lg border border-border bg-card/40 p-2';
    const width = columnWidths?.[col.id] ?? DEFAULT_COLUMN_WIDTH;
    const resizer = onSetColumnWidth && (
      <ColumnResizer
        label={label}
        width={width}
        onResize={(w) => onSetColumnWidth(col.id, w)}
        onReset={onResetColumnWidth ? () => onResetColumnWidth(col.id) : undefined}
      />
    );
    return dnd ? (
      <DroppableColumn key={col.id} columnId={col.id} className={cardClass} style={{ width }}>
        {columnBody(col)}
        {resizer}
      </DroppableColumn>
    ) : (
      <div key={col.id} className={cardClass} style={{ width }}>
        {columnBody(col)}
        {resizer}
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
  style,
  children,
}: {
  columnId: string;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(columnId) });
  return (
    <div ref={setNodeRef} style={style} className={cn(className, isOver && 'ring-2 ring-ring')}>
      {children}
    </div>
  );
}

/** A drag-to-resize handle on a column's right edge (mirrors the resizable sidebar). Pointer-drag to
 *  set the width, arrow keys to nudge for keyboard a11y, double-click to reset to the default. */
function ColumnResizer({
  label,
  width,
  onResize,
  onReset,
}: {
  label: string;
  width: number;
  onResize: (width: number) => void;
  onReset?: () => void;
}) {
  const onPointerDown = (event: ReactPointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (e: PointerEvent) => onResize(startWidth + (e.clientX - startX));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onResize(width - 16);
        else if (e.key === 'ArrowRight') onResize(width + 16);
      }}
      title="Drag to resize · double-click to reset"
      className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize rounded-r-lg bg-transparent transition-colors hover:bg-ring focus-visible:bg-ring focus-visible:outline-hidden"
    />
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
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
      />
    </form>
  );
}
