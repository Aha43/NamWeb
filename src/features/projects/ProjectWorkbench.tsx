import { Fragment, useState, type FormEvent } from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StatusMenu } from '../actions/StatusMenu';
import { ReorderControls } from '../actions/ReorderControls';
import { ReorderableActionList } from '@/components/dnd/ReorderableActionList';
import { SortableList } from '@/components/dnd/SortableList';
import { SortableRow, type SortableRowRender } from '@/components/dnd/SortableRow';
import { ColumnView, type WorkbenchColumn } from './ColumnView';
import type { ActionRowData } from '../actions/rows';
import { ratioBorderClass, type MissionStat } from './missionStats';
import type { ViewMode } from './useViewMode';
import type { NamNode, NodeStatus } from '../../domain/types';

type MoveDirection = 'up' | 'down';

export interface ProjectWorkbenchProps {
  project: NamNode;
  /** Ancestor projects, top-most first (excludes the current project). */
  breadcrumb: NamNode[];
  actions: ActionRowData[];
  subProjects: NamNode[];
  subProjectStats?: MissionStat[];
  /** Workbench view mode + setter (list / heat-map / column). */
  viewMode?: ViewMode;
  onSetViewMode?: (mode: ViewMode) => void;
  /** Whether the Column mode is offered (desktop only). */
  columnAvailable?: boolean;
  /** Kanban columns (Unsorted + one per sub-project); used when viewMode === 'column'. */
  columns?: WorkbenchColumn[];
  onOpenProject: (id: string) => void;
  onOpenProjects: () => void;
  onAddAction: (title: string) => void;
  onAddSubProject: (title: string) => void;
  onAddActionToColumn?: (columnId: string, title: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit: (id: string) => void;
  onRename: (id: string, title: string) => void;
  /** Hand-order a direct action within the project (reorders the project's childIds). */
  onMoveAction?: (id: string, direction: MoveDirection) => void;
  /** Hand-order a direct sub-project within the project. */
  onMoveSubProject?: (id: string, direction: MoveDirection) => void;
  /** Commit a drag reorder of the project's direct actions (the full new id order). */
  onReorderActions?: (ids: string[]) => void;
  /** Commit a drag reorder of the project's direct sub-projects (the full new id order). */
  onReorderSubProjects?: (ids: string[]) => void;
  /** Whether drag-and-drop is mounted (desktop). Buttons remain regardless. */
  dndEnabled?: boolean;
  /** Hand-order an action within a column (the column's node's childIds). */
  onMoveActionInColumn?: (columnId: string, id: string, direction: MoveDirection) => void;
  /** Collapsed column ids + toggle (Column view; persisted per-project by the page). */
  collapsedColumns?: Set<string>;
  onToggleColumn?: (id: string) => void;
  /** Provided only when the project is a leaf (no children) — convert it back to an action. */
  onConvertToAction?: () => void;
  onSaveAsTemplate?: () => void;
  templateNames?: string[];
  onApplyTemplate?: (name: string) => void;
}

/** A project's workbench: breadcrumb, its direct actions, and its sub-projects — as a list, a
 *  heat-map, or Kanban columns. */
export function ProjectWorkbench({
  project,
  breadcrumb,
  actions,
  subProjects,
  subProjectStats,
  viewMode = 'list',
  onSetViewMode = () => {},
  columnAvailable = false,
  columns = [],
  onOpenProject,
  onOpenProjects,
  onAddAction,
  onAddSubProject,
  onAddActionToColumn = () => {},
  onSetStatus,
  onEdit,
  onRename,
  onMoveAction,
  onMoveSubProject,
  onReorderActions,
  onReorderSubProjects,
  dndEnabled,
  onMoveActionInColumn = () => {},
  collapsedColumns,
  onToggleColumn,
  onConvertToAction,
  onSaveAsTemplate,
  templateNames,
  onApplyTemplate,
}: ProjectWorkbenchProps) {
  const isColumn = viewMode === 'column';
  const subDnd = Boolean(dndEnabled && onReorderSubProjects && subProjects.length > 1);

  // One sub-project row; `drag` is supplied when drag-and-drop is mounted.
  const renderSub = (sub: NamNode, index: number, drag?: SortableRowRender) => (
    <li ref={drag?.setNodeRef} style={drag?.style} className="flex items-center gap-1 pr-2">
      <button
        type="button"
        aria-label={`Open ${sub.title}`}
        onClick={() => onOpenProject(sub.id)}
        className="flex flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-accent"
      >
        <span className="flex-1 truncate text-sm text-foreground">{sub.title}</span>
        {sub.childIds.length > 0 && (
          <span className="text-xs text-muted-foreground">{sub.childIds.length}</span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      <button
        type="button"
        aria-label={`Edit ${sub.title}`}
        onClick={() => onEdit(sub.id)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {drag?.handle}
      {onMoveSubProject && (
        <ReorderControls
          title={sub.title}
          onUp={index > 0 ? () => onMoveSubProject(sub.id, 'up') : undefined}
          onDown={index < subProjects.length - 1 ? () => onMoveSubProject(sub.id, 'down') : undefined}
        />
      )}
    </li>
  );
  return (
    <section className={cn('mx-auto space-y-4', isColumn ? 'w-full' : 'max-w-md')}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <button type="button" onClick={onOpenProjects} className="hover:text-foreground">
          Projects
        </button>
        {breadcrumb.map((ancestor) => (
          <span key={ancestor.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <button type="button" onClick={() => onOpenProject(ancestor.id)} className="hover:text-foreground">
              {ancestor.title}
            </button>
          </span>
        ))}
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">{project.title}</span>
      </nav>

      <div className="space-y-2">
        <QuickAdd label="Add action" placeholder="Add an action…" onAdd={onAddAction} />
        <QuickAdd label="Add sub-project" placeholder="Add a sub-project…" onAdd={onAddSubProject} />
        {onApplyTemplate && templateNames && templateNames.length > 0 && (
          <select
            aria-label="Add from template"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onApplyTemplate(e.target.value);
                e.target.value = '';
              }
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          >
            <option value="" disabled>
              Add from template…
            </option>
            {templateNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        {onSaveAsTemplate && (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onSaveAsTemplate}>
              Save as template…
            </Button>
          </div>
        )}
      </div>

      {subProjects.length > 0 && (
        <ViewSwitch mode={viewMode} onSet={onSetViewMode} columnAvailable={columnAvailable} />
      )}

      {isColumn ? (
        <ColumnView
          columns={columns}
          onOpenColumn={onOpenProject}
          onAddAction={onAddActionToColumn}
          onMoveAction={onMoveActionInColumn}
          onSetStatus={onSetStatus}
          onEdit={onEdit}
          onRename={onRename}
          collapsed={collapsedColumns}
          onToggleCollapse={onToggleColumn}
        />
      ) : (
        <>
          {actions.length > 0 && (
            <ReorderableActionList
              rows={actions}
              onEdit={onEdit}
              onRename={onRename}
              onReorder={onReorderActions}
              dndEnabled={dndEnabled}
              renderActions={(row, index) => (
                <>
                  {onMoveAction && (
                    <ReorderControls
                      title={row.title}
                      onUp={index > 0 ? () => onMoveAction(row.id, 'up') : undefined}
                      onDown={index < actions.length - 1 ? () => onMoveAction(row.id, 'down') : undefined}
                    />
                  )}
                  <StatusMenu
                    status={row.status}
                    title={row.title}
                    onSetStatus={(status) => onSetStatus(row.id, status)}
                  />
                </>
              )}
            />
          )}

          {subProjects.length > 0 && (
            <div className="space-y-1">
              <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sub-projects</p>
              {viewMode === 'heatmap' && subProjectStats ? (
                <div className="grid grid-cols-2 gap-2">
                  {subProjectStats.map((stat) => (
                    <button
                      key={stat.id}
                      type="button"
                      aria-label={`Open ${stat.title}`}
                      onClick={() => onOpenProject(stat.id)}
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border-2 bg-card p-3 text-left hover:bg-accent',
                        ratioBorderClass(stat.ratio),
                      )}
                    >
                      <span className="truncate text-sm font-medium text-foreground">{stat.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {stat.done}/{stat.total} done
                        {stat.subProjectCount > 0 && ` · ${stat.subProjectCount} sub`}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <SortableList
                  ids={subProjects.map((s) => s.id)}
                  onReorder={onReorderSubProjects ?? (() => {})}
                  disabled={!subDnd}
                >
                  <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                    {subProjects.map((sub, index) =>
                      subDnd ? (
                        <SortableRow key={sub.id} id={sub.id} label={sub.title}>
                          {(drag) => renderSub(sub, index, drag)}
                        </SortableRow>
                      ) : (
                        <Fragment key={sub.id}>{renderSub(sub, index)}</Fragment>
                      ),
                    )}
                  </ul>
                </SortableList>
              )}
            </div>
          )}

          {actions.length === 0 && subProjects.length === 0 && (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">Nothing here yet — add an action or a sub-project.</p>
              {onConvertToAction && (
                <Button type="button" variant="outline" size="sm" onClick={onConvertToAction}>
                  Convert to action
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ViewSwitch({
  mode,
  onSet,
  columnAvailable,
}: {
  mode: ViewMode;
  onSet: (mode: ViewMode) => void;
  columnAvailable: boolean;
}) {
  const options: { value: ViewMode; label: string }[] = [
    { value: 'list', label: 'List' },
    { value: 'heatmap', label: 'Heat-map' },
    ...(columnAvailable ? [{ value: 'column' as const, label: 'Column' }] : []),
  ];
  return (
    <div className="flex justify-end">
      <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={mode === opt.value}
            onClick={() => onSet(opt.value)}
            className={cn(
              'rounded px-2 py-1 font-medium transition-colors',
              mode === opt.value
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickAdd({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        aria-label={label}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
      />
      <Button type="submit" variant="outline" size="sm">
        Add
      </Button>
    </form>
  );
}
