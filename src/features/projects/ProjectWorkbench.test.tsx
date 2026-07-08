import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode } from '../../domain/types';
import type { ActionRowData } from '../actions/rows';
import { ProjectWorkbench } from './ProjectWorkbench';

function pnode(id: string, title: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title, description: null, status: 'BACKLOG', project: true,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

function actionRow(id: string, title: string): ActionRowData {
  return { id, title, description: null, status: 'NEXT', path: [], tags: [], dueAt: null, touchedAt: null };
}

function setup(over: Partial<React.ComponentProps<typeof ProjectWorkbench>> = {}) {
  const handlers = {
    onOpenProject: vi.fn(), onOpenProjects: vi.fn(), onAddAction: vi.fn(),
    onAddSubProject: vi.fn(), onSetStatus: vi.fn(), onEdit: vi.fn(), onRename: vi.fn(),
  };
  render(
    <ProjectWorkbench
      project={pnode('p', 'Kitchen reno')}
      breadcrumb={[pnode('home', 'Home')]}
      actions={[actionRow('a', 'Get quotes')]}
      subProjects={[pnode('s', 'Plumbing', { childIds: ['x'] })]}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

describe('ProjectWorkbench', () => {
  it('shows the breadcrumb, actions, and sub-project sections', () => {
    setup();
    expect(screen.getByText('Kitchen reno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText('Get quotes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Plumbing' })).toBeInTheDocument();
  });

  it('hides the ancestor path on action rows — the header already names it (#569)', () => {
    setup({
      actions: [{ ...actionRow('a', 'Get quotes'), path: [{ id: 'home', title: 'Home' }] }],
    });
    expect(screen.getByText('Get quotes')).toBeInTheDocument();
    // 'Home' appears only in the workbench breadcrumb, not as a path link on the row.
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('toggles each section with its own key — x/y/z (#436)', () => {
    const onToggleDetails = vi.fn();
    const onToggleSection = vi.fn();
    setup({ onSaveDetails: vi.fn(), onToggleDetails, onToggleSection });
    fireEvent.keyDown(document.body, { key: 'x' });
    expect(onToggleDetails).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'y' });
    expect(onToggleSection).toHaveBeenCalledWith('actions');
    fireEvent.keyDown(document.body, { key: 'z' });
    expect(onToggleSection).toHaveBeenCalledWith('subprojects');
  });

  it('ignores the section shortcuts while typing in a field (#436)', () => {
    const onToggleDetails = vi.fn();
    const onToggleSection = vi.fn();
    setup({ onSaveDetails: vi.fn(), onToggleDetails, onToggleSection });
    const input = screen.getByLabelText('Add action');
    fireEvent.keyDown(input, { key: 'x' });
    fireEvent.keyDown(input, { key: 'y' });
    fireEvent.keyDown(input, { key: 'z' });
    expect(onToggleDetails).not.toHaveBeenCalled();
    expect(onToggleSection).not.toHaveBeenCalled();
  });

  it('shows a Focus button on the actions header that enters focus', () => {
    const onFocus = vi.fn();
    setup({ onFocus });
    fireEvent.click(screen.getByRole('button', { name: 'Focus actions' }));
    expect(onFocus).toHaveBeenCalled();
  });

  it('inline-renames a sub-project via the rename button (not the editor)', () => {
    const { onRename, onEdit } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Rename Plumbing' }));
    const input = screen.getByLabelText('Rename Plumbing');
    fireEvent.change(input, { target: { value: 'Pipework' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('s', 'Pipework');
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('renders the Details panel only when onSaveDetails is wired', () => {
    const { rerender } = render(
      <ProjectWorkbench
        project={pnode('p', 'Kitchen reno')}
        breadcrumb={[]}
        actions={[]}
        subProjects={[]}
        onOpenProject={vi.fn()}
        onOpenProjects={vi.fn()}
        onAddAction={vi.fn()}
        onAddSubProject={vi.fn()}
        onSetStatus={vi.fn()}
        onEdit={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
    rerender(
      <ProjectWorkbench
        project={pnode('p', 'Kitchen reno')}
        breadcrumb={[]}
        actions={[]}
        subProjects={[]}
        onOpenProject={vi.fn()}
        onOpenProjects={vi.fn()}
        onAddAction={vi.fn()}
        onAddSubProject={vi.fn()}
        onSetStatus={vi.fn()}
        onEdit={vi.fn()}
        onRename={vi.fn()}
        onSaveDetails={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
  });

  it('navigates via breadcrumb and sub-project', () => {
    const { onOpenProject, onOpenProjects } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Plumbing' }));
    expect(onOpenProjects).toHaveBeenCalled();
    expect(onOpenProject).toHaveBeenCalledWith('home');
    expect(onOpenProject).toHaveBeenCalledWith('s');
  });

  it('renders the sub-project heat-map in heat-map mode', () => {
    const stats = [{ id: 's', title: 'Plumbing', subProjectCount: 0, done: 1, total: 4, ratio: 0.25 }];
    setup({ viewMode: 'list', subProjectStats: stats });
    expect(screen.queryByText('1/4 done')).not.toBeInTheDocument();
    setup({ viewMode: 'heatmap', subProjectStats: stats });
    expect(screen.getByText('1/4 done')).toBeInTheDocument();
  });

  it('the view switch reports the chosen mode (Column only when available)', () => {
    const onSetViewMode = vi.fn();
    setup({ columnAvailable: true, onSetViewMode });
    fireEvent.click(screen.getByRole('button', { name: 'Heat-map' }));
    expect(onSetViewMode).toHaveBeenCalledWith('heatmap');
    fireEvent.click(screen.getByRole('button', { name: 'Column' }));
    expect(onSetViewMode).toHaveBeenCalledWith('column');
  });

  it('toggles due-date sort from the workbench toolbar (#437)', () => {
    const onToggleDueSort = vi.fn();
    setup({ onToggleDueSort });
    fireEvent.click(screen.getByRole('button', { name: /Sort: manual order/i }));
    expect(onToggleDueSort).toHaveBeenCalled();
  });

  it('hides action reorder controls while sorted by due, shows them otherwise (#437)', () => {
    const rows = [actionRow('a', 'Get quotes'), actionRow('b', 'Measure')];
    const { rerender } = render(
      <ProjectWorkbench
        project={pnode('p', 'Kitchen reno')}
        breadcrumb={[]}
        actions={rows}
        subProjects={[]}
        onOpenProject={vi.fn()} onOpenProjects={vi.fn()} onAddAction={vi.fn()}
        onAddSubProject={vi.fn()} onSetStatus={vi.fn()} onEdit={vi.fn()} onRename={vi.fn()}
        onMoveAction={vi.fn()} dueSorted={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Move Measure up' })).toBeInTheDocument();
    rerender(
      <ProjectWorkbench
        project={pnode('p', 'Kitchen reno')}
        breadcrumb={[]}
        actions={rows}
        subProjects={[]}
        onOpenProject={vi.fn()} onOpenProjects={vi.fn()} onAddAction={vi.fn()}
        onAddSubProject={vi.fn()} onSetStatus={vi.fn()} onEdit={vi.fn()} onRename={vi.fn()}
        onMoveAction={vi.fn()} dueSorted
      />,
    );
    expect(screen.queryByRole('button', { name: 'Move Measure up' })).not.toBeInTheDocument();
  });

  it('applies a template from the picker', () => {
    const onApplyTemplate = vi.fn();
    setup({ templateNames: ['Starter'], onApplyTemplate });
    fireEvent.change(screen.getByLabelText('Add from template'), { target: { value: 'Starter' } });
    expect(onApplyTemplate).toHaveBeenCalledWith('Starter');
  });

  it('offers Save as template… as a quiet icon control in the pinned header (#686)', () => {
    const onSaveAsTemplate = vi.fn();
    setup({ onSaveAsTemplate });
    const trigger = screen.getByRole('button', { name: 'Save as template…' });
    // Lives beside Summary in the header, not down in the Sub-projects section.
    expect(trigger.parentElement).toContainElement(screen.getByRole('button', { name: 'Summary' }));
    fireEvent.click(trigger);
    const input = screen.getByLabelText('Template name');
    expect(input).toHaveValue('Kitchen reno');
    fireEvent.change(input, { target: { value: 'Reno starter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSaveAsTemplate).toHaveBeenCalledWith('Reno starter');
  });

  it('keeps the sub-projects list directly under its add box, template picker below (#686)', () => {
    setup({ templateNames: ['Starter'], onApplyTemplate: vi.fn(), onSaveAsTemplate: vi.fn() });
    const addBox = screen.getByLabelText('Add sub-project');
    const list = screen.getByRole('button', { name: 'Open Plumbing' });
    const picker = screen.getByLabelText('Add from template');
    // Top to bottom: add box → list → template picker, so a new sub-project lands where you typed.
    expect(addBox.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(list.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers convert-to-action for a leaf project', () => {
    const onConvertToAction = vi.fn();
    setup({ actions: [], subProjects: [], onConvertToAction });
    fireEvent.click(screen.getByRole('button', { name: 'Convert to action' }));
    expect(onConvertToAction).toHaveBeenCalled();
  });

  it('shows the add-action and add-sub-project rows in the lists (no separate add panel)', () => {
    setup();
    expect(screen.getByLabelText('Add action')).toBeInTheDocument();
    expect(screen.getByLabelText('Add sub-project')).toBeInTheDocument();
    // The old collapsible "Add to project" panel is gone.
    expect(screen.queryByRole('button', { name: 'Add to project' })).not.toBeInTheDocument();
  });

  it('keeps the add rows reachable for an empty project', () => {
    setup({ actions: [], subProjects: [] });
    expect(screen.getByLabelText('Add action')).toBeInTheDocument();
    expect(screen.getByLabelText('Add sub-project')).toBeInTheDocument();
  });

  it('toggles the Actions and Sub-projects section headers', () => {
    const onToggleSection = vi.fn();
    setup({ onToggleSection });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sub-projects' }));
    expect(onToggleSection).toHaveBeenCalledWith('actions');
    expect(onToggleSection).toHaveBeenCalledWith('subprojects');
  });

  it('hides a section body when it is collapsed', () => {
    setup({ collapsedSections: new Set(['actions']) });
    // The Actions header stays, but its rows are hidden; Sub-projects stays open.
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Get quotes')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Plumbing' })).toBeInTheDocument();
  });

  it('adds actions and sub-projects', () => {
    const { onAddAction, onAddSubProject } = setup();
    fireEvent.change(screen.getByLabelText('Add action'), { target: { value: 'Measure' } });
    fireEvent.submit(screen.getByLabelText('Add action'));
    fireEvent.change(screen.getByLabelText('Add sub-project'), { target: { value: 'Wiring' } });
    fireEvent.submit(screen.getByLabelText('Add sub-project'));
    expect(onAddAction).toHaveBeenCalledWith('Measure');
    expect(onAddSubProject).toHaveBeenCalledWith('Wiring');
  });

  it('multi-selects project actions and bulk-deletes them', () => {
    const onDeleteAction = vi.fn();
    setup({ actions: [actionRow('a', 'Get quotes'), actionRow('b', 'Buy paint')], onDeleteAction });

    // No checkboxes until select mode is on.
    expect(screen.queryByLabelText('Select Get quotes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select actions' }));

    fireEvent.click(screen.getByLabelText('Select Get quotes'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    // Bulk delete: open the count-aware confirm, then confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' })); // popover confirm
    expect(onDeleteAction).toHaveBeenCalledTimes(1);
    expect(onDeleteAction).toHaveBeenCalledWith('a');
  });

  it('bulk-groups selected actions into a named sub-project, and bulk-sets status', () => {
    const onGroupSelected = vi.fn();
    const onSetStatus = vi.fn();
    const onAddTagToActions = vi.fn();
    setup({
      actions: [actionRow('a', 'Get quotes'), actionRow('b', 'Buy paint')],
      onDeleteAction: vi.fn(),
      onGroupSelected,
      onAddTagToActions,
      onSetStatus,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select actions' }));
    fireEvent.click(screen.getByLabelText('Select Get quotes'));
    fireEvent.click(screen.getByLabelText('Select Buy paint'));

    // Make sub-project from selected (anchored prompt).
    fireEvent.click(screen.getByRole('button', { name: 'Make sub-project from selected' }));
    fireEvent.change(screen.getByLabelText('Sub-project name'), { target: { value: 'Quotes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onGroupSelected).toHaveBeenCalledWith(['a', 'b'], 'Quotes');
  });

  it('bulk-sets status on selected actions', () => {
    const onSetStatus = vi.fn();
    setup({ actions: [actionRow('a', 'Get quotes')], onDeleteAction: vi.fn(), onSetStatus });
    fireEvent.click(screen.getByRole('button', { name: 'Select actions' }));
    fireEvent.click(screen.getByLabelText('Select Get quotes'));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Status ▾' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Backlog' }));
    expect(onSetStatus).toHaveBeenCalledWith('a', 'BACKLOG');
  });

  it('bulk-moves selected actions to another project', () => {
    const onMoveActionInto = vi.fn();
    setup({
      actions: [actionRow('a', 'Get quotes'), actionRow('b', 'Buy paint')],
      onDeleteAction: vi.fn(),
      actionMoveTargets: () => [
        { id: 'B', label: 'Project B', kind: 'sibling' },
        { id: 'free', label: 'Free actions', kind: 'free' },
      ],
      onMoveActionInto,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select actions' }));
    fireEvent.click(screen.getByLabelText('Select Get quotes'));
    fireEvent.click(screen.getByLabelText('Select Buy paint'));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move to ▾' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Project B' }));
    expect(onMoveActionInto).toHaveBeenCalledWith('a', 'B');
    expect(onMoveActionInto).toHaveBeenCalledWith('b', 'B');
  });

  it('moves a single action to another project from its row menu', () => {
    const onMoveActionInto = vi.fn();
    setup({
      actions: [actionRow('a', 'Get quotes')],
      actionMoveTargets: () => [{ id: 'free', label: 'Free actions', kind: 'free' }],
      onMoveActionInto,
    });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move Get quotes to another project' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Free actions' }));
    expect(onMoveActionInto).toHaveBeenCalledWith('a', 'free');
  });

  it('bulk-adds a tag to selected actions', () => {
    const onAddTagToActions = vi.fn();
    setup({ actions: [actionRow('a', 'Get quotes')], onDeleteAction: vi.fn(), onAddTagToActions });
    fireEvent.click(screen.getByRole('button', { name: 'Select actions' }));
    fireEvent.click(screen.getByLabelText('Select Get quotes'));
    fireEvent.click(screen.getByRole('button', { name: 'Add tag to selected' }));
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'home' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    expect(onAddTagToActions).toHaveBeenCalledWith(['a'], 'home');
  });

  it('exiting select mode clears the selection and hides checkboxes', () => {
    setup({ actions: [actionRow('a', 'Get quotes')], onDeleteAction: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Select actions' }));
    fireEvent.click(screen.getByLabelText('Select Get quotes'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exit select' }));
    expect(screen.queryByLabelText('Select Get quotes')).not.toBeInTheDocument();
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('has no Select toggle when delete is not wired', () => {
    setup({ actions: [actionRow('a', 'Get quotes')] }); // no onDeleteAction
    expect(screen.queryByRole('button', { name: 'Select actions' })).not.toBeInTheDocument();
  });

  it('deletes the project\'s done actions via the modal confirm', () => {
    const onDeleteAction = vi.fn();
    setup({
      actions: [actionRow('a', 'Get quotes'), { ...actionRow('d', 'Old task'), status: 'DONE' }],
      onDeleteAction,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete done actions' }));
    // Modal confirm with a count-aware message.
    expect(screen.getByText(/Delete 1 done action in/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleteAction).toHaveBeenCalledTimes(1);
    expect(onDeleteAction).toHaveBeenCalledWith('d');
  });

  it('has no Delete-done button when there are no done actions', () => {
    setup({ actions: [actionRow('a', 'Get quotes')], onDeleteAction: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Delete done actions' })).not.toBeInTheDocument();
  });
});
