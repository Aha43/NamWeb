import { type CSSProperties, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/** What a sortable row needs to render: a ref + style for the row element and a ready-made handle. */
export interface SortableRowRender {
  setNodeRef: (el: HTMLElement | null) => void;
  style: CSSProperties;
  handle: ReactNode;
}

/**
 * Makes one row drag-sortable. Use inside a {@link SortableList} via a render-prop: spread `style`
 * and `setNodeRef` onto the row element and place `handle` in its actions slot. Only mount this when
 * drag is enabled — `useSortable` must run inside a `SortableContext`.
 */
export function SortableRow({
  id,
  label,
  children,
}: {
  id: string;
  /** Accessible label for the handle, e.g. the row title. */
  label: string;
  children: (render: SortableRowRender) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' : undefined,
  };
  const handle = (
    <button
      type="button"
      aria-label={`Drag to reorder ${label}`}
      {...attributes}
      {...listeners}
      className="cursor-grab touch-none rounded-sm text-muted-foreground hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return <>{children({ setNodeRef, style, handle })}</>;
}
