import { type ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';

/**
 * Wraps a vertical list so its items can be drag-reordered (desktop). When `disabled` (e.g. on a
 * phone), it renders children passthrough — no DnD context is mounted — so the up/down buttons stay
 * the only reorder control. `onReorder` gets the full new id order; wire it to the matching reorder
 * intent (`reorderView` / `reorderChildren`). `ids` must list the sortable rows in display order.
 */
export function SortableList({
  ids,
  onReorder,
  disabled = false,
  children,
}: {
  ids: string[];
  onReorder: (ids: string[]) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  // A small drag threshold so a click on the handle (or row) doesn't start a phantom drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Nothing to reorder with fewer than two items — skip the DndContext entirely (it would
  // otherwise mount a `role="status"` live region for drag announcements).
  if (disabled || ids.length < 2) return <>{children}</>;

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
