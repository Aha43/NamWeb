import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { buildPath, projectActions, reorderKindWithinChildren, subProjects } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import type { NamNode } from '@/domain/types';
import type { ClonedTemplateNode } from '@/domain/mutations';
import type { TemplateNode } from '@/domain/types';
import { toActionRow } from '@/features/actions/rows';
import { ProjectWorkbench } from '@/features/projects/ProjectWorkbench';
import type { WorkbenchColumn } from '@/features/projects/ColumnView';
import { missionStats } from '@/features/projects/missionStats';
import { useViewMode } from '@/features/projects/useViewMode';
import { useCollapsedColumns } from '@/features/projects/useCollapsedColumns';
import { useCollapsedAddPanel } from '@/features/projects/useCollapsedAddPanel';
import { useCollapsedSections } from '@/features/projects/useCollapsedSections';
import { useIsDesktop } from '@/shell/useIsDesktop';
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
  const { openEditor } = useActionEditor();
  const deleteNode = useDeleteNode();
  const navigate = useNavigate();
  const [mode, setMode] = useViewMode(id);
  const [collapsedColumns, toggleColumn] = useCollapsedColumns(id);
  const [addPanelCollapsed, toggleAddPanel] = useCollapsedAddPanel(id);
  const [collapsedSections, toggleSection] = useCollapsedSections(id);
  const isDesktop = useIsDesktop();

  if (!document) return null;
  const project = document.nodes[id];
  if (!project || !project.project) return <Navigate to="/projects" replace />;

  const actionNodes = projectActions(document, id);
  const subProjectNodes = subProjects(document, id);
  const actions = actionNodes.map((n) => toActionRow(document, n));

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
      breadcrumb={buildPath(document, id)}
      actions={actions}
      subProjects={subProjectNodes}
      subProjectStats={hasSubs ? missionStats(document, id) : undefined}
      viewMode={viewMode}
      onSetViewMode={setMode}
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
      addPanelCollapsed={addPanelCollapsed}
      onToggleAddPanel={toggleAddPanel}
      collapsedSections={collapsedSections}
      onToggleSection={toggleSection}
      onAddAction={(title) =>
        dispatch({ type: 'addAction', parentId: id, id: newId(), title, status: 'NEXT', now: nowIso() })
      }
      onAddActionToColumn={(columnId, title) =>
        dispatch({ type: 'addAction', parentId: columnId, id: newId(), title, status: 'NEXT', now: nowIso() })
      }
      onAddSubProject={(title) =>
        dispatch({ type: 'addSubProject', parentId: id, id: newId(), title, now: nowIso() })
      }
      onSetStatus={(actionId, status) => dispatch({ type: 'setStatus', id: actionId, status, now: nowIso() })}
      onEdit={openEditor}
      onFocus={() => navigate(`/focus?project=${id}`)}
      onDeleteAction={deleteNode}
      onRename={(actionId, title) => {
        const node = document.nodes[actionId];
        if (node) dispatch({ type: 'updateNode', id: actionId, title, description: node.description, now: nowIso() });
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
        }
      }}
    />
  );
}
