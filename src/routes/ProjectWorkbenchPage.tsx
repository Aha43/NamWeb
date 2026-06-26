import { useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { actionMoveTargets, actionMoveTargetsAll, allTags, buildPath, effectiveTags, projectActions, projectMoveTargets, projectQuickMoveTargets, reorderKindWithinChildren, subProjects, subtreeIds } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import { normalizeTags } from '@/domain/mutations';
import type { NamNode } from '@/domain/types';
import type { ClonedTemplateNode } from '@/domain/mutations';
import type { TemplateNode } from '@/domain/types';
import type { ActionEdits } from '@/features/actions/ActionDialog';
import { toActionRow } from '@/features/actions/rows';
import { ProjectWorkbench } from '@/features/projects/ProjectWorkbench';
import { AddBookmarkButton } from '@/features/bookmarks/AddBookmarkButton';
import type { WorkbenchColumn } from '@/features/projects/ColumnView';
import { missionStats } from '@/features/projects/missionStats';
import { projectSummaryMarkdown } from '@/domain/projectSummary';
import { useViewMode, type ViewMode } from '@/features/projects/useViewMode';
import { useCollapsedColumns } from '@/features/projects/useCollapsedColumns';
import { useColumnWidths } from '@/features/projects/useColumnWidths';
import { useCollapsedDetails } from '@/features/projects/useCollapsedDetails';
import { useCollapsedSections } from '@/features/projects/useCollapsedSections';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { useSettings } from '@/components/settings/settings-context';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useDeleteNode } from '@/features/actions/useDeleteNode';
import { useWorkspaceContext } from '@/store/workspace-context';

/** Resolve a template subtree to concrete nodes (fresh ids) for applyTemplate. */
function cloneTemplateNodes(nodes: TemplateNode[]): ClonedTemplateNode[] {
  return nodes.map((n) => ({ id: newId(), title: n.title, project: n.project, children: cloneTemplateNodes(n.children) }));
}

export function ProjectWorkbenchPage() {
  const { id = '' } = useParams();
  const { document, dispatch } = useWorkspaceContext();
  const { addToBottom } = useSettings();
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const navigate = useNavigate();
  const [mode, setMode] = useViewMode(id);
  const [collapsedColumns, toggleColumn] = useCollapsedColumns(id);
  const { widths: columnWidths, setWidth: setColumnWidth, resetWidth: resetColumnWidth } = useColumnWidths(id);
  const [detailsCollapsed, toggleDetails] = useCollapsedDetails(id);
  const [collapsedSections, toggleSection] = useCollapsedSections(id);
  const isDesktop = useIsDesktop();
  // Where to land after this project is deleted. Stashed at delete time (while the node still
  // exists) so the "project gone" guard below can redirect there deterministically — an imperative
  // navigate raced that guard and flaked. Defaults to the Projects list.
  const postDeleteNavRef = useRef<string | null>(null);

  if (!document) return null;
  const project = document.nodes[id];
  if (!project || !project.project) return <Navigate to={postDeleteNavRef.current ?? '/projects'} replace />;

  const actionNodes = projectActions(document, id);
  const subProjectNodes = subProjects(document, id);
  const actions = actionNodes.map((n) => toActionRow(document, n));

  // Save the current project's edited details (inline Details panel) — dispatch only the intents
  // for fields that actually changed, mirroring the action editor's save.
  const saveDetails = (edits: ActionEdits) => {
    const now = nowIso();
    if (edits.title !== project.title || edits.description !== project.description) {
      dispatch({ type: 'updateNode', id, title: edits.title, description: edits.description, now });
    }
    const tags = normalizeTags(edits.tags);
    if (tags.length !== project.tags.length || tags.some((t, i) => t !== project.tags[i])) {
      dispatch({ type: 'updateTags', id, tags, now });
    }
    if (edits.dueAt !== project.dueAt) dispatch({ type: 'setDue', id, dueAt: edits.dueAt, now });
    if (edits.status !== project.status) dispatch({ type: 'setStatus', id, status: edits.status, now });
    if (JSON.stringify(edits.resources) !== JSON.stringify(project.resources)) {
      dispatch({ type: 'updateResources', id, resources: edits.resources, now });
    }
  };

  // Delete the whole project (recursive) from its Details panel, then climb to the parent project
  // (or the Projects list when it was top-level), since this workbench is about to vanish.
  const descendants = subtreeIds(document, id).size - 1;
  const deleteProjectMessage =
    descendants > 0
      ? `Delete the "${project.title}" project and its ${descendants} item${descendants === 1 ? '' : 's'}? This cannot be undone.`
      : `Delete the "${project.title}" project? This cannot be undone.`;
  // Delete the whole project (recursive). Stash the post-delete destination — the parent project,
  // or the Projects list when this was top-level — before the node vanishes, then delete. The guard
  // above performs the actual redirect, avoiding a race between an imperative navigate and the guard.
  const deleteProject = () => {
    const ancestors = buildPath(document, id); // top-most first; last is the immediate parent project
    const parentProject = ancestors[ancestors.length - 1];
    postDeleteNavRef.current = parentProject ? `/projects/${parentProject.id}` : '/projects';
    deleteNode(id);
  };

  // Count-aware confirm for deleting a sub-project from its row (#419). Deleting one keeps us on this
  // workbench (the current project survives), so — unlike deleteProject — no post-delete redirect.
  const deleteSubProjectMessage = (subId: string) => {
    const sub = document.nodes[subId];
    if (!sub) return 'Delete this sub-project? This cannot be undone.';
    const subDescendants = subtreeIds(document, subId).size - 1;
    return subDescendants > 0
      ? `Delete the "${sub.title}" sub-project and its ${subDescendants} item${subDescendants === 1 ? '' : 's'}? This cannot be undone.`
      : `Delete the "${sub.title}" sub-project? This cannot be undone.`;
  };

  // Sections collapse by default on open (#279); when you add to one, expand it so the new item is
  // visible rather than dropped into a collapsed section.
  const ensureSectionExpanded = (section: 'actions' | 'subprojects') => {
    if (collapsedSections.has(section)) toggleSection(section);
  };

  // The view switch (list / heat-map / column) only changes how sub-projects render, all inside the
  // (collapsible) Sub-projects section. Picking a view while that section is folded shows no visible
  // change, which reads as "nothing happened" — so expand it on explicit selection (#418).
  const selectViewMode = (next: ViewMode) => {
    setMode(next);
    ensureSectionExpanded('subprojects');
  };

  // Column mode is desktop-only and needs sub-projects; otherwise fall back to a list.
  const hasSubs = subProjectNodes.length > 0;
  const viewMode = !hasSubs ? 'list' : mode === 'column' && !isDesktop ? 'list' : mode;

  // Kanban columns: Unsorted (the project's own actions) + one per sub-project.
  const columns: WorkbenchColumn[] = [
    { id, title: project.title, isUnsorted: true, actions },
    ...subProjectNodes.map((sp) => ({
      id: sp.id,
      title: sp.title,
      isUnsorted: false,
      actions: projectActions(document, sp.id).map((n) => toActionRow(document, n)),
    })),
  ];

  // Hand-order a child within its kind by swapping its childIds slot with the adjacent same-kind
  // sibling, then persisting the whole new childIds order (shared with the desktop).
  const moveChild = (parentId: string, kind: NamNode[], nodeId: string, direction: 'up' | 'down') => {
    const parent = document.nodes[parentId];
    if (!parent) return;
    const i = kind.findIndex((n) => n.id === nodeId);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= kind.length) return;
    const order = [...parent.childIds];
    const a = order.indexOf(nodeId);
    const b = order.indexOf(kind[j].id);
    [order[a], order[b]] = [order[b], order[a]];
    dispatch({ type: 'reorderChildren', parentId, order });
  };

  // Drag reorder: splice one kind's new order back into the project's childIds (other kind stays put).
  const reorderKind = (newKindOrder: string[]) =>
    dispatch({
      type: 'reorderChildren',
      parentId: id,
      order: reorderKindWithinChildren(project.childIds, newKindOrder),
    });

  // Column-view drag: reorder within a column, or reparent an action to another column then place
  // it at the drop index. `moveNode` appends to the target's childIds, so the post-move order is
  // deterministic; `reorderKindWithinChildren` keeps that column's sub-projects in place.
  const moveActionToColumn = (
    actionId: string,
    fromColumnId: string,
    toColumnId: string,
    targetActionIds: string[],
  ) => {
    if (fromColumnId === toColumnId) {
      const col = document.nodes[toColumnId];
      if (col) dispatch({ type: 'reorderChildren', parentId: toColumnId, order: reorderKindWithinChildren(col.childIds, targetActionIds) });
      return;
    }
    dispatch({ type: 'moveNode', id: actionId, newParentId: toColumnId, now: nowIso() });
    const col = document.nodes[toColumnId];
    if (col) {
      const afterMove = [...col.childIds, actionId];
      dispatch({ type: 'reorderChildren', parentId: toColumnId, order: reorderKindWithinChildren(afterMove, targetActionIds) });
    }
  };

  return (
    <ProjectWorkbench
      project={project}
      bookmarkSlot={<AddBookmarkButton draft={{ kind: 'project', projectId: id, label: project.title }} />}
      breadcrumb={buildPath(document, id)}
      actions={actions}
      subProjects={subProjectNodes}
      subProjectStats={hasSubs ? missionStats(document, id) : undefined}
      buildSummary={(options) => projectSummaryMarkdown(document, id, options)}
      viewMode={viewMode}
      onSetViewMode={selectViewMode}
      columnAvailable={isDesktop}
      columns={columns}
      onOpenProject={(pid) => navigate(`/projects/${pid}`)}
      onOpenProjects={() => navigate('/projects')}
      onMoveAction={(actionId, direction) => moveChild(id, actionNodes, actionId, direction)}
      onMoveSubProject={(pid, direction) => moveChild(id, subProjectNodes, pid, direction)}
      onReorderActions={reorderKind}
      onReorderSubProjects={reorderKind}
      dndEnabled={isDesktop}
      onMoveActionInColumn={(columnId, actionId, direction) =>
        moveChild(columnId, projectActions(document, columnId), actionId, direction)
      }
      onMoveActionToColumn={moveActionToColumn}
      onMoveColumn={(columnId, direction) =>
        moveChild(id, subProjectNodes, columnId, direction === 'left' ? 'up' : 'down')
      }
      collapsedColumns={collapsedColumns}
      onToggleColumn={toggleColumn}
      columnWidths={columnWidths}
      onSetColumnWidth={setColumnWidth}
      onResetColumnWidth={resetColumnWidth}
      collapsedSections={collapsedSections}
      onToggleSection={toggleSection}
      onAddAction={(title) => {
        // New project actions land in BACKLOG (not NEXT) so they don't flood Next/Focus before
        // you've triaged them — matches NamDesktop's default. Issue #210.
        dispatch({ type: 'addAction', parentId: id, id: newId(), title, status: 'BACKLOG', atTop: !addToBottom, now: nowIso() });
        ensureSectionExpanded('actions');
      }}
      onAddActionToColumn={(columnId, title) =>
        dispatch({ type: 'addAction', parentId: columnId, id: newId(), title, status: 'BACKLOG', atTop: !addToBottom, now: nowIso() })
      }
      onAddSubProject={(title) => {
        dispatch({ type: 'addSubProject', parentId: id, id: newId(), title, atTop: !addToBottom, now: nowIso() });
        ensureSectionExpanded('subprojects');
      }}
      onSetStatus={(actionId, status) => dispatch({ type: 'setStatus', id: actionId, status, now: nowIso() })}
      onEdit={openEditor}
      detailsCollapsed={detailsCollapsed}
      onToggleDetails={toggleDetails}
      onSaveDetails={saveDetails}
      projectInheritedTags={effectiveTags(document, id).filter((t) => !project.tags.includes(t))}
      onDeleteProject={deleteProject}
      deleteProjectMessage={deleteProjectMessage}
      onFocus={() => navigate(`/focus?project=${id}`)}
      onDeleteAction={deleteNode}
      onGroupSelected={(actionIds, title) =>
        dispatch({ type: 'groupIntoSubProject', parentId: id, subProjectId: newId(), title, actionIds, now: nowIso() })
      }
      allTags={allTags(document)}
      onAddTagToActions={(actionIds, tag) => {
        const now = nowIso();
        for (const actionId of actionIds) {
          const node = document.nodes[actionId];
          if (node) dispatch({ type: 'updateTags', id: actionId, tags: [...node.tags, tag], now });
        }
      }}
      onRename={(actionId, title) => {
        const node = document.nodes[actionId];
        if (node) dispatch({ type: 'updateNode', id: actionId, title, description: node.description, now: nowIso() });
      }}
      moveTargets={(subId) => projectMoveTargets(document, subId)}
      quickMoveTargets={(subId) => projectQuickMoveTargets(document, subId)}
      onMoveInto={(subId, targetId) => dispatch({ type: 'moveNode', id: subId, newParentId: targetId, now: nowIso() })}
      onDeleteSubProject={deleteNode}
      deleteSubProjectMessage={deleteSubProjectMessage}
      actionMoveTargets={(actionId) => actionMoveTargets(document, actionId)}
      actionBrowseTargets={(actionId) => actionMoveTargetsAll(document, actionId)}
      onMoveActionInto={(actionId, targetId) => dispatch({ type: 'moveNode', id: actionId, newParentId: targetId, now: nowIso() })}
      onCreateProject={(parentId, title) => {
        const newProjectId = newId();
        dispatch({
          type: 'addSubProject',
          parentId: parentId ?? document.projectsNodeId,
          id: newProjectId,
          title,
          atTop: !addToBottom,
          now: nowIso(),
        });
        return newProjectId;
      }}
      onConvertToAction={
        project.childIds.length === 0
          ? () => dispatch({ type: 'convertProjectToAction', id, status: 'NEXT', now: nowIso() })
          : undefined
      }
      onSaveAsTemplate={(name) => dispatch({ type: 'saveAsTemplate', name, nodeId: id })}
      templateNames={document.templates.map((t) => t.name)}
      onApplyTemplate={(name) => {
        const template = document.templates.find((t) => t.name === name);
        if (template) {
          dispatch({ type: 'applyTemplate', parentId: id, nodes: cloneTemplateNodes(template.children), now: nowIso() });
          // Reveal the cloned-in structure rather than dropping it into collapsed sections (#279).
          ensureSectionExpanded('actions');
          ensureSectionExpanded('subprojects');
        }
      }}
    />
  );
}
