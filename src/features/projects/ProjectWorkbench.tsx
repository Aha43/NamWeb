import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownUp, CheckSquare, ChevronDown, ChevronRight, FileText, FolderInput, LayoutTemplate, Pencil, Target, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { InlineRename } from '../actions/InlineRename';
import { DueHintLabel } from '../actions/DueHintLabel';
import { Button } from '@/components/ui/button';
import { AddPositionToggle } from '@/components/settings/AddPositionToggle';
import { useSettings } from '@/components/settings/settings-context';
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
import { ShareButton } from '@/features/sharing/ShareButton';
import { ProjectDetailsPanel } from './ProjectDetailsPanel';
import type { ActionEdits } from '../actions/ActionDialog';
import { descriptionTooltip, type ActionRowData } from '../actions/rows';
import { heatBorderClass, type MissionStat } from './missionStats';
import type { ViewMode } from './useViewMode';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { isModalOpen, isTypingTarget } from '@/shell/useGlobalShortcuts';
import { ProjectPickerDialog } from './picker/ProjectPickerDialog';
import { MoveTargetMenu } from './picker/MoveTargetMenu';
import type { PickerTarget } from './picker/pickerModel';
import type { QuickMoveTarget } from '@/domain/lenses';
import type { EffectiveDue } from '@/domain/derivedDue';
import type { DueFields } from '../actions/DueFieldset';
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
  /** Bulk status change with a single grouped Undo toast; falls back to per-id `onSetStatus`. */
  onSetStatusMany?: (ids: string[], status: NodeStatus) => void;
  /** Open an action's editor (the dialog). Actions only. */
  onEdit: (id: string) => void;
  /** Collapsed state of the current project's "Details" (edit) panel + toggle (persisted by the page). */
  detailsCollapsed?: boolean;
  onToggleDetails?: () => void;
  /** Save edits to the current project's title/notes/tags/due/status/resources. */
  onSaveDetails?: (edits: ActionEdits) => void;
  /** Tags this project inherits from its ancestors ("rub-off") — shown read-only in Details. */
  projectInheritedTags?: string[];
  /** Persist the "derive from contents" toggle (#706) — the Details panel's checkbox. */
  onSetDeriveDue?: (on: boolean) => void;
  /** Persist a due-fields commit from the Details panel (#709) — dues no longer ride onSaveDetails. */
  onSaveDue?: (fields: DueFields) => void;
  /** A project's effective due span (derived gap-fill, #706) — row hints + Details ghosts. */
  effectiveDueOf?: (id: string) => EffectiveDue;
  /** Delete the current project — opens the advanced-delete dialog from the Details panel. */
  onDeleteProject?: () => void;
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
  /** Delete a sub-project — opens the advanced-delete dialog (content disposition + undo). */
  onDeleteSubProject?: (id: string) => void;
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
  /** Sort actions by due date (soonest first, undated last) instead of manual order — applies to the
   *  list and the Kanban cards. While on, manual reorder of actions is suppressed (#437). */
  dueSorted?: boolean;
  onToggleDueSort?: () => void;
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
  onSetStatusMany,
  onEdit,
  detailsCollapsed = true,
  onToggleDetails = () => {},
  onSaveDetails,
  projectInheritedTags = [],
  onSetDeriveDue,
  onSaveDue,
  effectiveDueOf,
  onDeleteProject,
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
  dueSorted = false,
  onToggleDueSort,
}: ProjectWorkbenchProps) {
  const { t } = useTranslation();
  const isColumn = viewMode === 'column';
  const subDnd = Boolean(dndEnabled && onReorderSubProjects && subProjects.length > 1);
  // Whether there's anything for the "by due" toggle to act on (list rows or any column's cards).
  const anyActions = actions.length > 0 || columns.some((c) => c.actions.length > 0);
  const sectionCollapsed = (section: 'actions' | 'subprojects') => collapsedSections?.has(section) ?? false;

  const [renamingSubId, setRenamingSubId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const { dense } = useSettings();

  // Workbench keyboard shortcuts: `x` Details, `y` Actions, `z` Sub-projects (#436), `s` Summary
  // (#472). One key per target so each is predictable, rather than one overloaded "toggle all".
  // Scoped to the workbench because this component is only mounted there; ignores typing/modifier/IME
  // so it never fires mid-edit or steals browser/OS combos.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      if (isTypingTarget(e.target)) return;
      // A modal (the action editor, Summary…) owns the keys — `s`/`x`/`y`/`z` must not toggle
      // the workbench behind it (#614, same guard as the global shortcuts, #486).
      if (isModalOpen()) return;
      if (e.key === 'x') onToggleDetails();
      else if (e.key === 'y') onToggleSection('actions');
      else if (e.key === 'z') onToggleSection('subprojects');
      else if (e.key === 's') setSummaryOpen(true);
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleDetails, onToggleSection]);
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
    if (onSetStatusMany) onSetStatusMany([...selected], status);
    else for (const id of selected) onSetStatus(id, status);
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
            onCommit={(newTitle) => { onRename(sub.id, newTitle); setRenamingSubId(null); }}
            onCancel={() => setRenamingSubId(null)}
          />
        </div>
      ) : (
        <>
          <Tooltip label={subDescTip}>
          <button
            type="button"
            aria-label={t('column.openAria', { title: sub.title })}
            onClick={() => onOpenProject(sub.id)}
            className="flex flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-accent"
          >
            {subDescTip ? (
              <span className="block min-w-0 flex-1 truncate text-sm text-foreground">{sub.title}</span>
            ) : (
              <TruncatedTitle text={sub.title} className="min-w-0 flex-1 text-sm text-foreground" />
            )}
            {/* Sub-projects tell time too (#700) — the same urgency-toned hint action rows carry,
                derived edges italic (#706). */}
            {effectiveDueOf ? (
              <DueHintLabel {...effectiveDueOf(sub.id)} />
            ) : (
              <DueHintLabel dueAt={sub.dueAt} dueEndAt={sub.dueEndAt} dueTime={sub.dueTime} dueEndTime={sub.dueEndTime} />
            )}
            {sub.childIds.length > 0 && (
              <span className="text-xs text-muted-foreground">{sub.childIds.length}</span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          </Tooltip>
          <Tooltip label={t('actions.renameAria', { title: sub.title })}>
            <button
              type="button"
              aria-label={t('actions.renameAria', { title: sub.title })}
              onClick={() => setRenamingSubId(sub.id)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          {onMoveInto && subTargets.length > 0 && (
            isDesktop ? (
              <MoveTargetMenu
                label={t('projects.moveIntoAria', { title: sub.title })}
                quickTargets={subQuick}
                onPick={(id) => onMoveInto(sub.id, id)}
                onBrowse={() =>
                  setMoveRequest({
                    title: t('editor.moveTitle', { title: sub.title }),
                    targets: subTargets,
                    onConfirm: (id) => onMoveInto(sub.id, id),
                  })
                }
              >
                <FolderInput className="h-3.5 w-3.5" />
              </MoveTargetMenu>
            ) : (
              <DropdownMenu>
                <Tooltip label={t('projects.moveIntoTooltip')}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('projects.moveIntoAria', { title: sub.title })}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                  {subTargets.map((target) => (
                    <DropdownMenuItem key={target.id} onSelect={() => onMoveInto(sub.id, target.id)}>
                      {target.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          )}
          {onDeleteSubProject && (
            <Tooltip label={t('actions.deleteAria', { title: sub.title })}>
              <button
                type="button"
                aria-label={t('actions.deleteAria', { title: sub.title })}
                onClick={() => onDeleteSubProject(sub.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
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
        <nav aria-label={t('workbench.breadcrumb')} className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <button type="button" onClick={onOpenProjects} className="hover:text-foreground">
            {t('domain.projects')}
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
          {onSaveAsTemplate && (
            <PromptButton
              aria-label={t('workbench.saveAsTemplate')}
              label={t('workbench.templateName')}
              initialValue={project.title}
              submitLabel={t('common.save')}
              onSubmit={onSaveAsTemplate}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LayoutTemplate className="h-4 w-4" />
            </PromptButton>
          )}
          <ShareButton projectId={project.id} />
          <Tooltip label={t('workbench.summaryTooltip')}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              aria-label={t('workbench.summary')}
              onClick={() => setSummaryOpen(true)}
            >
              <FileText className="h-4 w-4" />
              {/* Dense trims the text — the icon is descriptive and the tooltip names it (#731). */}
              {!dense && t('workbench.summary')}
            </Button>
          </Tooltip>
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
          onSetDeriveDue={onSetDeriveDue}
          onSaveDue={onSaveDue}
          derivedDue={effectiveDueOf?.(project.id)}
        />
      )}

      {(anyActions || subProjects.length > 0) && (
        <div className="flex items-center justify-end gap-2">
          {onToggleDueSort && anyActions && (
            <DueSortToggle sorted={dueSorted} onToggle={onToggleDueSort} />
          )}
          {subProjects.length > 0 && (
            <ViewSwitch mode={viewMode} onSet={onSetViewMode} columnAvailable={columnAvailable} />
          )}
        </div>
      )}
      </div>

      <div className="space-y-4 pt-4">
      {isColumn ? (
        <>
          {onFocus && actions.length > 0 && (
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onFocus}>
                <Target className="h-4 w-4 focus-glow" />
                {t('domain.focus')}
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
          dueSorted={dueSorted}
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
                    label={t('workbench.actions')}
                    count={actions.length}
                    collapsed={sectionCollapsed('actions')}
                    onToggle={() => onToggleSection('actions')}
                    shortcutKey="y"
                  />
                </div>
                {actions.length > 0 && onDeleteAction && (
                  <Tooltip label={selectMode ? t('list.exitSelect') : t('done.selectActions')}>
                    <button
                      type="button"
                      aria-label={selectMode ? t('list.exitSelect') : t('done.selectActions')}
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
                  <Tooltip label={t('workbench.deleteDoneTooltip', { count: doneActions.length })}>
                    <button
                      type="button"
                      aria-label={t('workbench.deleteDoneAria')}
                      onClick={() => setDeleteDoneOpen(true)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
                {actions.length > 0 && onFocus && (
                  <Tooltip label={t('workbench.focusTooltip')}>
                    <button
                      type="button"
                      aria-label={t('workbench.focusAria')}
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
                  <span className="mr-1 text-muted-foreground">{t('actions.selectedCount', { count: selected.size })}</span>
                  {onGroupSelected && (
                    <PromptButton
                      aria-label={t('workbench.makeSubAria')}
                      label={t('workbench.subProjectName')}
                      placeholder={t('workbench.nameGroup')}
                      submitLabel={t('common.create')}
                      onSubmit={bulkGroup}
                      disabled={selected.size === 0}
                      className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      {t('workbench.makeSubProject')}
                    </PromptButton>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={selected.size === 0}
                      className="rounded-md px-2 py-0.5 font-medium text-foreground outline-hidden hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      {t('workbench.statusMenu')}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={() => bulkSetStatus('NEXT')}>{t('domain.status.next')}</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => bulkSetStatus('BACKLOG')}>{t('domain.status.backlog')}</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => bulkSetStatus('DONE')}>{t('domain.status.done')}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {onMoveActionInto && moveActionTargets.length > 0 && (
                    isDesktop ? (
                      <MoveTargetMenu
                        label={t('workbench.moveSelectedAria')}
                        disabled={selected.size === 0}
                        triggerClassName="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                        quickTargets={moveActionTargets}
                        onPick={bulkMove}
                        onBrowse={() =>
                          setMoveRequest({
                            title: t('workbench.moveActionsTitle', { count: selected.size }),
                            targets: moveActionBrowseTargets,
                            onConfirm: bulkMove,
                          })
                        }
                      >
                        {t('workbench.moveTo')}
                      </MoveTargetMenu>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={selected.size === 0}
                          className="rounded-md px-2 py-0.5 font-medium text-foreground outline-hidden hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                        >
                          {t('workbench.moveTo')}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                          {moveActionTargets.map((target) => (
                            <DropdownMenuItem key={target.id} onSelect={() => bulkMove(target.id)}>
                              {target.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  )}
                  {onAddTagToActions && (
                    <PromptButton
                      aria-label={t('workbench.addTagAria')}
                      label={t('workbench.tag')}
                      placeholder={t('workbench.addTagPlaceholder')}
                      submitLabel={t('workbench.addTagSubmit')}
                      suggestions={allTags}
                      onSubmit={bulkAddTag}
                      disabled={selected.size === 0}
                      className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      {t('workbench.tag')}
                    </PromptButton>
                  )}
                  <ConfirmButton
                    aria-label={t('done.deleteSelectedAria')}
                    message={t('workbench.deleteSelectedConfirm', { count: selected.size })}
                    onConfirm={bulkDelete}
                    disabled={selected.size === 0}
                    className="rounded-md px-2 py-0.5 font-medium text-destructive hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                  >
                    {t('common.delete')}
                  </ConfirmButton>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(actions.map((a) => a.id)))}
                    disabled={selected.size === actions.length}
                    className="ml-auto rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    {t('common.selectAll')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    disabled={selected.size === 0}
                    className="rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    {t('common.clear')}
                  </button>
                </div>
              )}
              {/* Add-action row lives in the list, always reachable (even when empty or collapsed). */}
              <QuickAdd label={t('workbench.addAction')} placeholder={t('column.addActionPlaceholder')} onAdd={onAddAction} />
              {!sectionCollapsed('actions') && actions.length > 0 && (
                <ReorderableActionList
                  rows={actions}
                  showPath={false}
                  onEdit={onEdit}
                  onDelete={onDeleteAction}
                  onRename={onRename}
                  onReorder={onReorderActions}
                  dndEnabled={dndEnabled && !dueSorted}
                  selectedIds={selectMode ? selected : undefined}
                  onToggleSelect={selectMode ? toggleSelect : undefined}
                  renderActions={(row, index) => (
                    <>
                      {onMoveAction && !dueSorted && (
                        <ReorderControls
                          title={row.title}
                          onUp={index > 0 ? () => onMoveAction(row.id, 'up') : undefined}
                          onDown={index < actions.length - 1 ? () => onMoveAction(row.id, 'down') : undefined}
                        />
                      )}
                      {onMoveActionInto && moveActionTargets.length > 0 && (
                        isDesktop ? (
                          <MoveTargetMenu
                            label={t('workbench.moveActionAria', { title: row.title })}
                            quickTargets={moveActionTargets}
                            onPick={(id) => onMoveActionInto(row.id, id)}
                            onBrowse={() =>
                              setMoveRequest({
                                title: t('editor.moveTitle', { title: row.title }),
                                targets: moveActionBrowseTargets,
                                onConfirm: (id) => onMoveActionInto(row.id, id),
                              })
                            }
                          >
                            <FolderInput className="h-3.5 w-3.5" />
                          </MoveTargetMenu>
                        ) : (
                        <DropdownMenu>
                          <Tooltip label={t('workbench.moveToTooltip')}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={t('workbench.moveActionAria', { title: row.title })}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                              >
                                <FolderInput className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                            {moveActionTargets.map((target) => (
                              <DropdownMenuItem key={target.id} onSelect={() => onMoveActionInto(row.id, target.id)}>
                                {target.label}
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
                label={t('workbench.subProjects')}
                count={subProjects.length}
                collapsed={sectionCollapsed('subprojects')}
                onToggle={() => onToggleSection('subprojects')}
                shortcutKey="z"
              />
              {/* Add-sub-project row lives in the Sub-projects section, always reachable — the list
                  renders directly under it so a new sub-project appears where you just typed. */}
              <QuickAdd label={t('workbench.addSubProject')} placeholder={t('workbench.addSubProjectPlaceholder')} onAdd={onAddSubProject} />
              {!sectionCollapsed('subprojects') && subProjects.length > 0 && (viewMode === 'heatmap' && subProjectStats ? (
                <div className="grid grid-cols-2 gap-2">
                  {subProjectStats.map((stat) => (
                    <button
                      key={stat.id}
                      type="button"
                      aria-label={t('column.openAria', { title: stat.title })}
                      onClick={() => onOpenProject(stat.id)}
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border-2 bg-card p-3 text-left hover:bg-accent',
                        heatBorderClass(stat),
                      )}
                    >
                      <span className="truncate text-sm font-medium text-foreground">{stat.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {stat.total === 0 ? t('workbench.noActions') : t('workbench.doneCount', { done: stat.done, total: stat.total })}
                        {stat.subProjectCount > 0 && ` · ${t('workbench.subCount', { count: stat.subProjectCount })}`}
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
              {/* Hidden while collapsed — applying a template into an invisible list reads as "nothing
                  happened" (#694). */}
              {!sectionCollapsed('subprojects') && onApplyTemplate && templateNames && templateNames.length > 0 && (
                <div className="flex justify-start pt-1">
                  <select
                    aria-label={t('workbench.addFromTemplateAria')}
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
                      {t('workbench.addFromTemplateOption')}
                    </option>
                    {templateNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

          {/* Empty leaf project: offer to turn it back into an action (the sections above carry the add rows). */}
          {onConvertToAction && actions.length === 0 && subProjects.length === 0 && (
            <div className="py-4 text-center">
              <Button type="button" variant="outline" size="sm" onClick={onConvertToAction}>
                {t('workbench.convertToAction')}
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
        title={t('workbench.deleteDoneTitle')}
        message={t('workbench.deleteDoneConfirm', { count: doneActions.length, title: project.title })}
        confirmLabel={t('common.delete')}
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

/** A binary toggle for the workbench action order: manual (childIds) ↔ by due date. Sits beside the
 *  view switch so it's reachable from both the list and the column board. */
function DueSortToggle({ sorted, onToggle }: { sorted: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <Tooltip label={sorted ? t('workbench.dueSortOnTooltip') : t('workbench.dueSortOffTooltip')}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={sorted}
        aria-label={sorted ? t('workbench.dueSortOnAria') : t('workbench.dueSortOffAria')}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
          sorted
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <ArrowDownUp className="h-3.5 w-3.5" />
        {sorted ? t('workbench.byDue') : t('workbench.manual')}
      </button>
    </Tooltip>
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
  const { t } = useTranslation();
  const options: { value: ViewMode; label: string }[] = [
    { value: 'list', label: 'workbench.viewList' },
    { value: 'heatmap', label: 'workbench.viewHeatmap' },
    ...(columnAvailable ? [{ value: 'column' as const, label: 'workbench.viewColumn' }] : []),
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
            {t(opt.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A collapsible section heading (Actions / Sub-projects) for the List & Heat-map views. The
 *  tooltip names the keyboard shortcut that toggles this section (#436). */
function SectionHeader({
  label,
  count,
  collapsed,
  onToggle,
  shortcutKey,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  /** The key that toggles this section, shown in the tooltip (e.g. `y` for Actions). */
  shortcutKey?: string;
}) {
  const { t } = useTranslation();
  return (
    <Tooltip label={`${collapsed ? t('workbench.expand') : t('workbench.collapse')} ${label}${shortcutKey ? ` (${shortcutKey})` : ''}`}>
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
    </Tooltip>
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
  const { t } = useTranslation();
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
        {t('common.add')}
      </Button>
    </form>
  );
}
