import { Fragment, useState, type FormEvent } from 'react';
import { ChevronRight, Pencil, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { SortableList } from '@/components/dnd/SortableList';
import { SortableRow, type SortableRowRender } from '@/components/dnd/SortableRow';
import { InlineRename } from '../actions/InlineRename';
import { ReorderControls } from '../actions/ReorderControls';
import type { NamNode } from '../../domain/types';

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
  dndEnabled,
  onAddLearnNam,
}: ProjectsPanelProps) {
  const [title, setTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }

  const ids = projects.map((p) => p.id);
  const dnd = Boolean(dndEnabled && onReorder && projects.length > 1);

  // Up/down: swap a project with its neighbour and persist the whole new order.
  function move(index: number, direction: 'up' | 'down') {
    if (!onReorder) return;
    const j = direction === 'up' ? index - 1 : index + 1;
    if (j < 0 || j >= ids.length) return;
    const order = [...ids];
    [order[index], order[j]] = [order[j], order[index]];
    onReorder(order);
  }

  // One project row; `drag` is supplied when rendered inside a SortableContext.
  const renderRow = (project: NamNode, index: number, drag?: SortableRowRender) => (
    <li
      ref={drag?.setNodeRef}
      style={drag?.style}
      className="flex items-center gap-1 pr-2 transition-colors even:bg-muted/40 hover:bg-accent/40"
    >
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
      ) : (
        <SortableList ids={ids} onReorder={onReorder ?? (() => {})} disabled={!dnd}>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {projects.map((project, index) =>
              dnd ? (
                <SortableRow key={project.id} id={project.id} label={project.title}>
                  {(drag) => renderRow(project, index, drag)}
                </SortableRow>
              ) : (
                <Fragment key={project.id}>{renderRow(project, index)}</Fragment>
              ),
            )}
          </ul>
        </SortableList>
      )}
    </section>
  );
}
