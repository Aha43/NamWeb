import { Fragment, useState, type FormEvent, type ReactNode } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, FileText, FolderInput, Pencil, Target, Trash2 } from 'lucide-react';
import { InlineRename } from '../actions/InlineRename';
import { Button } from '@/components/ui/button';
import { AddPositionToggle } from '@/components/settings/AddPositionToggle';
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
import { descriptionTooltip, type ActionRowData } from '../actions/rows';
import { heatBorderClass, type MissionStat } from './missionStats';
import type { ViewMode } from './useViewMode';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { ProjectPickerDialog } from './picker/ProjectPickerDialog';
import { MoveTargetMenu } from './picker/MoveTargetMenu';
import type { PickerTarget } from './picker/pickerModel';
import type { QuickMoveTarget } from '@/domain/lenses';
import type { NamNode, NodeStatus } from '../../domain/types';

type MoveDirection = 'up' | 'down';

export interface ProjectWorkbenchProps {
  project: NamNode;
  /** Optional header control (e.g. the bookmark toggle), shown beside Summary. */
  bookmarkSlot?: ReactNode;
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
  /** Tags this project inherits from its ancestors ("rub-off") — shown read-only in Details. */
  projectInheritedTags?: string[];
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
  /** All projects a sub-project can move into (the "Browse all projects…" picker set). */
  moveTargets?: (id: string) => { id: string; label: string }[];
  /** Proximate sub-project destinations (Top level + siblings) for the quick menu. */
  quickMoveTargets?: (id: string) => QuickMoveTarget[];
  /** Make a sub-project a child of `targetId` (or top-level). */
  onMoveInto?: (id: string, targetId: string) => void;
  /** Inline delete (with confirm) for a sub-project row, recursive when it has descendants. */
  onDeleteSubProject?: (id: string) => void;
  /** Count-aware confirm message for a sub-project delete. */
  deleteSubProjectMessage?: (id: string) => string;
  /** Proximate action destinations (parent / siblings / sub-projects / Free actions) for the quick menu. */
  actionMoveTargets?: (id: string) => QuickMoveTarget[];
  /** All projects an action can move into (the "Browse all projects…" picker set). */
  actionBrowseTargets?: (id: string) => { id: string; label: string }[];
  /** Move an action under `targetId` (a project, or the Free-actions root). */
  onMoveActionInto?: (id: string, targetId: string) => void;
  /** Create a project under `parentId` (null = top level) and return its id — powers the picker's
   *  "New project here". */
  onCreateProject?: (parentId: string | null, title: string) => string;
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
  /** Per-column widths + setters (Column view; persisted per-project by the page). */
  columnWidths?: Record<string, number>;
  onSetColumnWidth?: (id: string, width: number) => void;
  onResetColumnWidth?: (id: string) => void;
  /** Provided only when the project is a leaf (no children) — convert it back to an action. */
  onConvertToAction?: () => void;
  onSaveAsTemplate?: (name: string) => void;
  templateNames?: string[];
  onApplyTemplate?: (name: string) => void;
  /** Collapsed sections (Actions / Sub-projects) for List & Heat-map + toggle (persisted by the page). */
  collapsedSections?: Set<string>;
  onToggleSection?: (section: 'actions' | 'subprojects') => void;
}

/** A project's workbench: breadcrumb, its direct actions, and its sub-projects — as a list, a
 *  heat-map, or Kanban columns. */
export function ProjectWorkbench({
  project,
  bookmarkSlot,
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
  projectInheritedTags = [],
  onDeleteProject,
  deleteProjectMessage,
  onFocus,
  onDeleteAction,
  onGroupSelected,
  onAddTagToActions,
  allTags,
  onRename,
  moveTargets,
  quickMoveTargets,
  onMoveInto,
  onDeleteSubProject,
  deleteSubProjectMessage,
  actionMoveTargets,
  actionBrowseTargets,
  onMoveActionInto,
  onCreateProject,
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
  columnWidths,
  onSetColumnWidth,
  onResetColumnWidth,
  onConvertToAction,
  onSaveAsTemplate,
  templateNames,
  onApplyTemplate,
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
  const bulkMove = (targetId: string) => {
    for (const id of selected) onMoveActionInto?.(id, targetId);
    setSelected(new Set());
  };
  // All listed actions are direct children of this project, so they share the same destinations.
  // Quick = proximate (parent/siblings/Free); browse = every project (for the picker).
  const moveActionTargets = actionMoveTargets && actions[0] ? actionMoveTargets(actions[0].id) : [];
  const moveActionBrowseTargets =
    actionBrowseTargets && actions[0] ? actionBrowseTargets(actions[0].id) : moveActionTargets;
  // Delete the project's own done actions (direct only, no recursion) via a modal confirm.
  const doneActions = actions.filter((a) => a.status === 'DONE');
  const [deleteDoneOpen, setDeleteDoneOpen] = useState(false);
  // Desktop: one shared Finder-style picker for the "move into another project" controls (#425).
  // Phone keeps the inline dropdowns. A single instance is driven by the latest open request.
  const isDesktop = useIsDesktop();
  const [moveRequest, setMoveRequest] = useState<{
    title: string;
    targets: PickerTarget[];
    onConfirm: (id: string) => void;
  } | null>(null);
  const deleteDone = () => {
    if (onDeleteAction) for (const a of doneActions) onDeleteAction(a.id);
  };

  // One sub-project row; `drag` is supplied when drag-and-drop is mounted.
  const renderSub = (sub: NamNode, index: number, drag?: SortableRowRender) => {
    const subTargets = onMoveInto && moveTargets ? moveTargets(sub.id) : [];
    const subQuick = onMoveInto && quickMoveTargets ? quickMoveTargets(sub.id) : [];
    const subDescTip = descriptionTooltip(sub.description);
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
          <Tooltip label={subDescTip}>
          <button
            type="button"
            aria-label={`Open ${sub.title}`}
            onClick={() => onOpenProject(sub.id)}
            className="flex flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-accent"
          >
            {subDescTip ? (
              <span className="block min-w-0 flex-1 truncate text-sm text-foreground">{sub.title}</span>
            ) : (
              <TruncatedTitle text={sub.title} className="min-w-0 flex-1 text-sm text-foreground" />
            )}
            {sub.childIds.length > 0 && (
              <span className="text-xs text-muted-foreground">{sub.childIds.length}</span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          </Tooltip>
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
            isDesktop ? (
              <MoveTargetMenu
                label={`Move ${sub.title} into another project`}
                quickTargets={subQuick}
                onPick={(id) => onMoveInto(sub.id, id)}
                onBrowse={() =>
                  setMoveRequest({
                    title: `Move "${sub.title}" to…`,
                    targets: subTargets,
                    onConfirm: (id) => onMoveInto(sub.id, id),
                  })
                }
              >
                <FolderInput className="h-3.5 w-3.5" />
              </MoveTargetMenu>
            ) : (
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
            )
          )}
          {onDeleteSubProject && (
            <ConfirmButton
              aria-label={`Delete ${sub.title}`}
              message={deleteSubProjectMessage?.(sub.id) ?? `Delete the "${sub.title}" sub-project? This cannot be undone.`}
              onConfirm={() => onDeleteSubProject(sub.id)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </ConfirmButton>
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
        <div className="flex shrink-0 items-center gap-1">
          {bookmarkSlot}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setSummaryOpen(true)}
          >
            <FileText className="h-4 w-4" />
            Summary
          </Button>
        </div>
      </div>

      {onSaveDetails && (
        <ProjectDetailsPanel
          key={project.id}
          project={project}
          collapsed={detailsCollapsed}
          onToggle={onToggleDetails}
          onSave={onSaveDetails}
          availableTags={allTags}
          inheritedTags={projectInheritedTags}
          onDelete={onDeleteProject}
          deleteConfirmMessage={deleteProjectMessage}
        />
      )}

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
                <Target className="h-4 w-4 focus-glow" />
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
          columnWidths={columnWidths}
          onSetColumnWidth={onSetColumnWidth}
          onResetColumnWidth={onResetColumnWidth}
        />
        </>
      ) : (
        <>
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
                {actions.length > 0 && onDeleteAction && (
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
                {actions.length > 0 && onDeleteAction && doneActions.length > 0 && !selectMode && (
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
                {actions.length > 0 && onFocus && (
                  <Tooltip label="Focus this project's actions">
                    <button
                      type="button"
                      aria-label="Focus actions"
                      onClick={onFocus}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Target className="h-4 w-4 focus-glow" />
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
                      className="rounded-md px-2 py-0.5 font-medium text-foreground outline-hidden hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      Status ▾
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={() => bulkSetStatus('NEXT')}>Next</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => bulkSetStatus('BACKLOG')}>Backlog</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => bulkSetStatus('DONE')}>Done</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {onMoveActionInto && moveActionTargets.length > 0 && (
                    isDesktop ? (
                      <MoveTargetMenu
                        label="Move selected actions to another project"
                        disabled={selected.size === 0}
                        triggerClassName="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                        quickTargets={moveActionTargets}
                        onPick={bulkMove}
                        onBrowse={() =>
                          setMoveRequest({
                            title: `Move ${selected.size} action${selected.size === 1 ? '' : 's'} to…`,
                            targets: moveActionBrowseTargets,
                            onConfirm: bulkMove,
                          })
                        }
                      >
                        Move to ▾
                      </MoveTargetMenu>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={selected.size === 0}
                          className="rounded-md px-2 py-0.5 font-medium text-foreground outline-hidden hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                        >
                          Move to ▾
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                          {moveActionTargets.map((t) => (
                            <DropdownMenuItem key={t.id} onSelect={() => bulkMove(t.id)}>
                              {t.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  )}
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
              {/* Add-action row lives in the list, always reachable (even when empty or collapsed). */}
              <QuickAdd label="Add action" placeholder="Add an action…" onAdd={onAddAction} />
              {!sectionCollapsed('actions') && actions.length > 0 && (
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
                      {onMoveActionInto && moveActionTargets.length > 0 && (
                        isDesktop ? (
                          <MoveTargetMenu
                            label={`Move ${row.title} to another project`}
                            quickTargets={moveActionTargets}
                            onPick={(id) => onMoveActionInto(row.id, id)}
                            onBrowse={() =>
                              setMoveRequest({
                                title: `Move "${row.title}" to…`,
                                targets: moveActionBrowseTargets,
                                onConfirm: (id) => onMoveActionInto(row.id, id),
                              })
                            }
                          >
                            <FolderInput className="h-3.5 w-3.5" />
                          </MoveTargetMenu>
                        ) : (
                        <DropdownMenu>
                          <Tooltip label="Move to another project">
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Move ${row.title} to another project`}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                              >
                                <FolderInput className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                            {moveActionTargets.map((t) => (
                              <DropdownMenuItem key={t.id} onSelect={() => onMoveActionInto(row.id, t.id)}>
                                {t.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        )
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

          <div className="space-y-1">
              <SectionHeader
                label="Sub-projects"
                count={subProjects.length}
                collapsed={sectionCollapsed('subprojects')}
                onToggle={() => onToggleSection('subprojects')}
              />
              {/* Add-sub-project row + template tools live in the Sub-projects section, always reachable. */}
              <QuickAdd label="Add sub-project" placeholder="Add a sub-project…" onAdd={onAddSubProject} />
              {((onApplyTemplate && templateNames && templateNames.length > 0) || onSaveAsTemplate) && (
                <div className="flex flex-wrap items-center gap-2">
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
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
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
                    <PromptButton
                      label="Template name"
                      initialValue={project.title}
                      submitLabel="Save"
                      onSubmit={onSaveAsTemplate}
                      className="ml-auto rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      Save as template…
                    </PromptButton>
                  )}
                </div>
              )}
              {!sectionCollapsed('subprojects') && subProjects.length > 0 && (viewMode === 'heatmap' && subProjectStats ? (
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
              ))}
            </div>

          {/* Empty leaf project: offer to turn it back into an action (the sections above carry the add rows). */}
          {onConvertToAction && actions.length === 0 && subProjects.length === 0 && (
            <div className="py-4 text-center">
              <Button type="button" variant="outline" size="sm" onClick={onConvertToAction}>
                Convert to action
              </Button>
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

      {moveRequest && (
        <ProjectPickerDialog
          open
          onOpenChange={(o) => {
            if (!o) setMoveRequest(null);
          }}
          title={moveRequest.title}
          targets={moveRequest.targets}
          onConfirm={(id) => {
            moveRequest.onConfirm(id);
            setMoveRequest(null);
          }}
          onCreateProject={onCreateProject}
        />
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
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
      />
      <AddPositionToggle />
      <Button type="submit" variant="outline" size="sm">
        Add
      </Button>
    </form>
  );
}
