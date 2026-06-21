import { Fragment, useState, type FormEvent } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, FileText, FolderInput, Pencil, Target, Trash2 } from 'lucide-react';
import { InlineRename } from '../actions/InlineRename';
import { Button } from '@/components/ui/button';
import { PromptButton } from '@/components/ui/prompt-button';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { cn } from '@/lib/utils';
import { StatusMenu } from '../actions/StatusMenu';
import { ReorderControls } from '../actions/ReorderControls';
import { ReorderableActionList } from '@/components/dnd/ReorderableActionList';
import { SortableList } from '@/components/dnd/SortableList';
import { SortableRow, type SortableRowRender } from '@/components/dnd/SortableRow';
import { ColumnView, type WorkbenchColumn } from './ColumnView';
import { ProjectSummaryDialog } from './ProjectSummaryDialog';
import { ProjectDetailsPanel } from './ProjectDetailsPanel';
import type { ActionEdits } from '../actions/ActionDialog';
import type { ActionRowData } from '../actions/rows';
import { heatBorderClass, type MissionStat } from './missionStats';
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
  /** Build the Markdown summary for the chosen action statuses (the copyable Summary dialog). */
  buildSummary?: (options: import('@/domain/projectSummary').SummaryOptions) => string;
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
  /** Open an action's editor (the dialog). Actions only. */
  onEdit: (id: string) => void;
  /** Collapsed state of the current project's "Details" (edit) panel + toggle (persisted by the page). */
  detailsCollapsed?: boolean;
  onToggleDetails?: () => void;
  /** Save edits to the current project's title/notes/tags/due/status/resources. */
  onSaveDetails?: (edits: ActionEdits) => void;
  /** Delete the current project (recursive); the Details panel confirms inline. */
  onDeleteProject?: () => void;
  /** Count-aware confirm message for the project delete. */
  deleteProjectMessage?: string;
  /** Enter Focus mode over this project's open direct actions. */
  onFocus?: () => void;
  /** Inline delete (with confirm) for a direct action row. */
  onDeleteAction?: (id: string) => void;
  /** Bulk: move the selected actions into a new sub-project (named) under this project. */
  onGroupSelected?: (actionIds: string[], title: string) => void;
  /** Bulk: add a tag to the selected actions. */
  onAddTagToActions?: (actionIds: string[], tag: string) => void;
  /** Existing tags to suggest in the bulk Add-tag input. */
  allTags?: string[];
  onRename: (id: string, title: string) => void;
  /** Candidate projects to move a sub-project into (siblings first); excludes self + subtree. */
  moveTargets?: (id: string) => { id: string; label: string }[];
  /** Make a sub-project a child of `targetId` (or top-level). */
  onMoveInto?: (id: string, targetId: string) => void;
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
  /** Drag an action within / between columns (Column view). */
  onMoveActionToColumn?: (
    actionId: string,
    fromColumnId: string,
    toColumnId: string,
    targetActionIds: string[],
  ) => void;
  /** Reorder the columns (sub-projects) with left/right buttons (Column view). */
  onMoveColumn?: (columnId: string, direction: 'left' | 'right') => void;
  /** Collapsed column ids + toggle (Column view; persisted per-project by the page). */
  collapsedColumns?: Set<string>;
  onToggleColumn?: (id: string) => void;
  /** Provided only when the project is a leaf (no children) — convert it back to an action. */
  onConvertToAction?: () => void;
  onSaveAsTemplate?: (name: string) => void;
  templateNames?: string[];
  onApplyTemplate?: (name: string) => void;
  /** Collapsed state of the "Add to project" panel + toggle (persisted per-project by the page). */
  addPanelCollapsed?: boolean;
  onToggleAddPanel?: () => void;
  /** Collapsed sections (Actions / Sub-projects) for List & Heat-map + toggle (persisted by the page). */
  collapsedSections?: Set<string>;
  onToggleSection?: (section: 'actions' | 'subprojects') => void;
}

/** A project's workbench: breadcrumb, its direct actions, and its sub-projects — as a list, a
 *  heat-map, or Kanban columns. */
export function ProjectWorkbench({
  project,
  breadcrumb,
  actions,
  subProjects,
  subProjectStats,
  buildSummary = () => '',
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
  detailsCollapsed = true,
  onToggleDetails = () => {},
  onSaveDetails,
  onDeleteProject,
  deleteProjectMessage,
  onFocus,
  onDeleteAction,
  onGroupSelected,
  onAddTagToActions,
  allTags,
  onRename,
  moveTargets,
  onMoveInto,
  onMoveAction,
  onMoveSubProject,
  onReorderActions,
  onReorderSubProjects,
  dndEnabled,
  onMoveActionInColumn = () => {},
  onMoveActionToColumn,
  onMoveColumn,
  collapsedColumns,
  onToggleColumn,
  onConvertToAction,
  onSaveAsTemplate,
  templateNames,
  onApplyTemplate,
  addPanelCollapsed = false,
  onToggleAddPanel = () => {},
  collapsedSections,
  onToggleSection = () => {},
}: ProjectWorkbenchProps) {
  const isColumn = viewMode === 'column';
  const subDnd = Boolean(dndEnabled && onReorderSubProjects && subProjects.length > 1);
  const sectionCollapsed = (section: 'actions' | 'subprojects') => collapsedSections?.has(section) ?? false;
  const [renamingSubId, setRenamingSubId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  // Multi-select on the project's actions (session-only) for bulk delete.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const bulkDelete = () => {
    if (onDeleteAction) for (const id of selected) onDeleteAction(id);
    setSelected(new Set());
  };
  const bulkSetStatus = (status: NodeStatus) => {
    for (const id of selected) onSetStatus(id, status);
    setSelected(new Set());
  };
  const bulkGroup = (title: string) => {
    onGroupSelected?.([...selected], title);
    setSelected(new Set()); // stay in select mode so you can carve the next group
  };
  const bulkAddTag = (tag: string) => {
    onAddTagToActions?.([...selected], tag);
    setSelected(new Set());
  };
  // Delete the project's own done actions (direct only, no recursion) via a modal confirm.
  const doneActions = actions.filter((a) => a.status === 'DONE');
  const [deleteDoneOpen, setDeleteDoneOpen] = useState(false);
  const deleteDone = () => {
    if (onDeleteAction) for (const a of doneActions) onDeleteAction(a.id);
  };

  // One sub-project row; `drag` is supplied when drag-and-drop is mounted.
  const renderSub = (sub: NamNode, index: number, drag?: SortableRowRender) => {
    const subTargets = onMoveInto && moveTargets ? moveTargets(sub.id) : [];
    return (
    <li
      ref={drag?.setNodeRef}
      style={drag?.style}
      className="flex items-center gap-1 pr-2 transition-colors even:bg-muted/40 hover:bg-accent/40"
    >
      {renamingSubId === sub.id ? (
        <div className="flex-1 px-3 py-2">
          <InlineRename
            title={sub.title}
            onCommit={(t) => { onRename(sub.id, t); setRenamingSubId(null); }}
            onCancel={() => setRenamingSubId(null)}
          />
        </div>
      ) : (
        <>
          <button
            type="button"
            aria-label={`Open ${sub.title}`}
            onClick={() => onOpenProject(sub.id)}
            className="flex flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-accent"
          >
            <TruncatedTitle text={sub.title} className="min-w-0 flex-1 text-sm text-foreground" />
            {sub.childIds.length > 0 && (
              <span className="text-xs text-muted-foreground">{sub.childIds.length}</span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          <Tooltip label={`Rename ${sub.title}`}>
            <button
              type="button"
              aria-label={`Rename ${sub.title}`}
              onClick={() => setRenamingSubId(sub.id)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          {onMoveInto && subTargets.length > 0 && (
            <DropdownMenu>
              <Tooltip label="Move into another project">
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Move ${sub.title} into another project`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                {subTargets.map((t) => (
                  <DropdownMenuItem key={t.id} onSelect={() => onMoveInto(sub.id, t.id)}>
                    {t.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {drag?.handle}
          {onMoveSubProject && (
            <ReorderControls
              title={sub.title}
              onUp={index > 0 ? () => onMoveSubProject(sub.id, 'up') : undefined}
              onDown={index < subProjects.length - 1 ? () => onMoveSubProject(sub.id, 'down') : undefined}
            />
          )}
        </>
      )}
    </li>
    );
  };
  return (
    <section className="w-full">
      {/* Pinned header: breadcrumb + add-panel + view switch stay put while the lists scroll. */}
      <div className="sticky top-0 z-20 space-y-3 bg-background pb-2 pt-1">
      <div className="flex items-start justify-between gap-2">
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setSummaryOpen(true)}
        >
          <FileText className="h-4 w-4" />
          Summary
        </Button>
      </div>

      {onSaveDetails && (
        <ProjectDetailsPanel
          key={project.id}
          project={project}
          collapsed={detailsCollapsed}
          onToggle={onToggleDetails}
          onSave={onSaveDetails}
          availableTags={allTags}
          onDelete={onDeleteProject}
          deleteConfirmMessage={deleteProjectMessage}
        />
      )}

      <div className="rounded-lg border border-border">
        <button
          type="button"
          aria-expanded={!addPanelCollapsed}
          onClick={onToggleAddPanel}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          <span>Add to project</span>
          {addPanelCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {!addPanelCollapsed && (
          <div className="space-y-2 border-t border-border p-3">
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
                <PromptButton
                  label="Template name"
                  initialValue={project.title}
                  submitLabel="Save"
                  onSubmit={onSaveAsTemplate}
                  className="rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Save as template…
                </PromptButton>
              </div>
            )}
          </div>
        )}
      </div>

      {subProjects.length > 0 && (
        <ViewSwitch mode={viewMode} onSet={onSetViewMode} columnAvailable={columnAvailable} />
      )}
      </div>

      <div className="space-y-4 pt-4">
      {isColumn ? (
        <>
          {onFocus && actions.length > 0 && (
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onFocus}>
                <Target className="h-4 w-4" />
                Focus
              </Button>
            </div>
          )}
          <ColumnView
          columns={columns}
          onOpenColumn={onOpenProject}
          onAddAction={onAddActionToColumn}
          onMoveAction={onMoveActionInColumn}
          onMoveActionToColumn={onMoveActionToColumn}
          onMoveColumn={onMoveColumn}
          dndEnabled={dndEnabled}
          onSetStatus={onSetStatus}
          onEdit={onEdit}
          onDelete={onDeleteAction}
          onRename={onRename}
          collapsed={collapsedColumns}
          onToggleCollapse={onToggleColumn}
        />
        </>
      ) : (
        <>
          {actions.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <SectionHeader
                    label="Actions"
                    count={actions.length}
                    collapsed={sectionCollapsed('actions')}
                    onToggle={() => onToggleSection('actions')}
                  />
                </div>
                {onDeleteAction && (
                  <Tooltip label={selectMode ? 'Exit select' : 'Select actions'}>
                    <button
                      type="button"
                      aria-label={selectMode ? 'Exit select' : 'Select actions'}
                      aria-pressed={selectMode}
                      onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                      className={cn(
                        'rounded-md p-1 hover:bg-accent hover:text-foreground',
                        selectMode ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      <CheckSquare className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
                {onDeleteAction && doneActions.length > 0 && !selectMode && (
                  <Tooltip label={`Delete ${doneActions.length} done action${doneActions.length === 1 ? '' : 's'}`}>
                    <button
                      type="button"
                      aria-label="Delete done actions"
                      onClick={() => setDeleteDoneOpen(true)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
                {onFocus && (
                  <Tooltip label="Focus this project's actions">
                    <button
                      type="button"
                      aria-label="Focus actions"
                      onClick={onFocus}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Target className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
              </div>
              {selectMode && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
                  <span className="mr-1 text-muted-foreground">{selected.size} selected</span>
                  {onGroupSelected && (
                    <PromptButton
                      aria-label="Make sub-project from selected"
                      label="Sub-project name"
                      placeholder="Name the group…"
                      submitLabel="Create"
                      onSubmit={bulkGroup}
                      disabled={selected.size === 0}
                      className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      Make sub-project
                    </PromptButton>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={selected.size === 0}
                      className="rounded-md px-2 py-0.5 font-medium text-foreground outline-none hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      Status ▾
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={() => bulkSetStatus('NEXT')}>Next</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => bulkSetStatus('BACKLOG')}>Backlog</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => bulkSetStatus('DONE')}>Done</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {onAddTagToActions && (
                    <PromptButton
                      aria-label="Add tag to selected"
                      label="Tag"
                      placeholder="Add a tag…"
                      submitLabel="Add tag"
                      suggestions={allTags}
                      onSubmit={bulkAddTag}
                      disabled={selected.size === 0}
                      className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      Tag
                    </PromptButton>
                  )}
                  <ConfirmButton
                    aria-label="Delete selected actions"
                    message={`Delete ${selected.size} selected action${selected.size === 1 ? '' : 's'}? This cannot be undone.`}
                    onConfirm={bulkDelete}
                    disabled={selected.size === 0}
                    className="rounded-md px-2 py-0.5 font-medium text-destructive hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                  >
                    Delete
                  </ConfirmButton>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    disabled={selected.size === 0}
                    className="ml-auto rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
              )}
              {!sectionCollapsed('actions') && (
                <ReorderableActionList
                  rows={actions}
                  onEdit={onEdit}
                  onDelete={onDeleteAction}
                  onRename={onRename}
                  onReorder={onReorderActions}
                  dndEnabled={dndEnabled}
                  selectedIds={selectMode ? selected : undefined}
                  onToggleSelect={selectMode ? toggleSelect : undefined}
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
            </div>
          )}

          {subProjects.length > 0 && (
            <div className="space-y-1">
              <SectionHeader
                label="Sub-projects"
                count={subProjects.length}
                collapsed={sectionCollapsed('subprojects')}
                onToggle={() => onToggleSection('subprojects')}
              />
              {sectionCollapsed('subprojects') ? null : viewMode === 'heatmap' && subProjectStats ? (
                <div className="grid grid-cols-2 gap-2">
                  {subProjectStats.map((stat) => (
                    <button
                      key={stat.id}
                      type="button"
                      aria-label={`Open ${stat.title}`}
                      onClick={() => onOpenProject(stat.id)}
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border-2 bg-card p-3 text-left hover:bg-accent',
                        heatBorderClass(stat),
                      )}
                    >
                      <span className="truncate text-sm font-medium text-foreground">{stat.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {stat.total === 0 ? 'no actions' : `${stat.done}/${stat.total} done`}
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
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
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
      </div>

      <ProjectSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        title={project.title}
        buildSummary={buildSummary}
      />

      <ConfirmDialog
        open={deleteDoneOpen}
        onOpenChange={setDeleteDoneOpen}
        title="Delete done actions"
        message={`Delete ${doneActions.length} done action${doneActions.length === 1 ? '' : 's'} in "${project.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={deleteDone}
      />
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

/** A collapsible section heading (Actions / Sub-projects) for the List & Heat-map views. */
function SectionHeader({
  label,
  count,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      onClick={onToggle}
      className="flex w-full items-center gap-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
    >
      {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      <span>{label}</span>
      <span aria-hidden className="normal-case">
        {count}
      </span>
    </button>
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
