import { Fragment, useState, type FormEvent } from 'react';
import { ChevronRight, Pencil, SlidersHorizontal } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { SortableRow, type SortableRowRender } from '@/components/dnd/SortableRow';
import { cn } from '@/lib/utils';
import { InlineRename } from '../actions/InlineRename';
import { ReorderControls } from '../actions/ReorderControls';
import type { NamNode } from '../../domain/types';

const NEST_PREFIX = 'nest:';

export interface ProjectsPanelProps {
  projects: NamNode[];
  onAdd: (title: string) => void;
  onOpen: (id: string) => void;
  /** Inline-rename a project (deliberate, via the rename button — no dialog). */
  onRename?: (id: string, title: string) => void;
  /** Open the full editor (description, tags, due…) for a top-level project. */
  onEdit?: (id: string) => void;
  /** Persist a new top-level order (up/down buttons + desktop drag). Gets the full id order. */
  onReorder?: (orderedIds: string[]) => void;
  /** Drop one project onto another → make the dragged one a sub-project of the target (desktop). */
  onNest?: (dragId: string, targetId: string) => void;
  /** Mount drag-and-drop (desktop). The up/down buttons are the always-on fallback. */
  dndEnabled?: boolean;
  /** Seed the hands-on "Learn NAM" onboarding project (also a safe demo — delete to tidy up). */
  onAddLearnNam?: () => void;
}

/** Top-level projects: quick-add plus the list, each opening into the workbench. Presentational. */
export function ProjectsPanel({
  projects,
  onAdd,
  onOpen,
  onRename,
  onEdit,
  onReorder,
  onNest,
  dndEnabled,
  onAddLearnNam,
}: ProjectsPanelProps) {
  const [title, setTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nestTargetId, setNestTargetId] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }

  const ids = projects.map((p) => p.id);
  const dnd = Boolean(dndEnabled && (onReorder || onNest) && projects.length > 1);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Up/down: swap a project with its neighbour and persist the whole new order.
  function move(index: number, direction: 'up' | 'down') {
    if (!onReorder) return;
    const j = direction === 'up' ? index - 1 : index + 1;
    if (j < 0 || j >= ids.length) return;
    const order = [...ids];
    [order[index], order[j]] = [order[j], order[index]];
    onReorder(order);
  }

  // Hovering the middle band of a *different* row = nest there; the edges = reorder before/after.
  const collisionDetection: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    if (hits.length === 0) return [];
    const rowHit = hits.find((h) => !String(h.id).startsWith(NEST_PREFIX)) ?? hits[0];
    if (onNest && String(rowHit.id) !== String(args.active.id)) {
      const rect = args.droppableRects.get(rowHit.id);
      const y = args.pointerCoordinates?.y;
      if (rect && y != null) {
        const rel = (y - rect.top) / rect.height;
        if (rel > 0.25 && rel < 0.75) {
          const nestHit = hits.find((h) => h.id === `${NEST_PREFIX}${String(rowHit.id)}`);
          if (nestHit) return [nestHit];
        }
      }
    }
    return [rowHit];
  };

  function onDragOver(event: DragOverEvent) {
    const over = event.over ? String(event.over.id) : '';
    setNestTargetId(over.startsWith(NEST_PREFIX) ? over.slice(NEST_PREFIX.length) : null);
  }

  function onDragEnd(event: DragEndEvent) {
    setNestTargetId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (overId.startsWith(NEST_PREFIX)) {
      const target = overId.slice(NEST_PREFIX.length);
      if (target !== activeId) onNest?.(activeId, target);
      return;
    }
    if (overId !== activeId && onReorder) {
      const from = ids.indexOf(activeId);
      const to = ids.indexOf(overId);
      if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to));
    }
  }

  // One project row; `drag` is supplied when rendered inside a SortableContext.
  const renderRow = (project: NamNode, index: number, drag?: SortableRowRender, nestActive = false) => (
    <li
      ref={drag?.setNodeRef}
      style={drag?.style}
      className="relative flex items-center gap-1 pr-2 transition-colors even:bg-muted/40 hover:bg-accent/40"
    >
      {dnd && onNest && <NestZone id={project.id} active={nestActive} />}
      {renamingId === project.id && onRename ? (
        <div className="flex-1 px-3 py-2">
          <InlineRename
            title={project.title}
            onCommit={(t) => { onRename(project.id, t); setRenamingId(null); }}
            onCancel={() => setRenamingId(null)}
          />
        </div>
      ) : (
        <>
          <button
            type="button"
            aria-label={`Open ${project.title}`}
            onClick={() => onOpen(project.id)}
            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-accent"
          >
            <span className="min-w-0 flex-1">
              <TruncatedTitle text={project.title} className="text-sm text-foreground" />
              {project.tags.length > 0 && (
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {project.tags.map((tag) => (
                    <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </span>
              )}
            </span>
            {project.childIds.length > 0 && (
              <span className="text-xs text-muted-foreground">{project.childIds.length}</span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          {onRename && (
            <Tooltip label={`Rename ${project.title}`}>
              <button
                type="button"
                aria-label={`Rename ${project.title}`}
                onClick={() => setRenamingId(project.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {onEdit && (
            <Tooltip label={`Edit ${project.title}`}>
              <button
                type="button"
                aria-label={`Edit ${project.title}`}
                onClick={() => onEdit(project.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {drag?.handle}
          {onReorder && (
            <ReorderControls
              title={project.title}
              onUp={index > 0 ? () => move(index, 'up') : undefined}
              onDown={index < projects.length - 1 ? () => move(index, 'down') : undefined}
            />
          )}
        </>
      )}
    </li>
  );

  const list = (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {projects.map((project, index) =>
        dnd ? (
          <SortableRow key={project.id} id={project.id} label={project.title}>
            {(drag) => renderRow(project, index, drag, nestTargetId === project.id)}
          </SortableRow>
        ) : (
          <Fragment key={project.id}>{renderRow(project, index)}</Fragment>
        ),
      )}
    </ul>
  );

  return (
    <section className="space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <input
          aria-label="Add project"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New project…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-ring"
        />
        <Button type="submit">Add</Button>
      </form>

      {onAddLearnNam && projects.length > 0 && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onAddLearnNam}>
            Add Learn NAM 🥋
          </Button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="space-y-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">No projects yet.</p>
          {onAddLearnNam && (
            <p className="text-sm text-muted-foreground">
              New to NAM?{' '}
              <button type="button" onClick={onAddLearnNam} className="font-medium text-primary hover:underline">
                Add the Learn NAM project 🥋
              </button>{' '}
              and learn by doing.
            </p>
          )}
        </div>
      ) : dnd ? (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setNestTargetId(null)}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
        </DndContext>
      ) : (
        list
      )}
    </section>
  );
}

/** Full-row drop target for "nest as sub-project"; highlights when it's the active nest target.
 *  `pointer-events-none` so it never blocks the row's own buttons (dnd measures its rect, not clicks). */
function NestZone({ id, active }: { id: string; active: boolean }) {
  const { setNodeRef } = useDroppable({ id: `${NEST_PREFIX}${id}` });
  return (
    <div
      ref={setNodeRef}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-10 rounded-md',
        active && 'bg-primary/5 ring-2 ring-inset ring-primary',
      )}
    />
  );
}
