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
  return { id, title, status: 'NEXT', path: [], tags: [], dueAt: null, touchedAt: null };
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

  it('applies a template from the picker', () => {
    const onApplyTemplate = vi.fn();
    setup({ templateNames: ['Starter'], onApplyTemplate });
    fireEvent.change(screen.getByLabelText('Add from template'), { target: { value: 'Starter' } });
    expect(onApplyTemplate).toHaveBeenCalledWith('Starter');
  });

  it('offers convert-to-action for a leaf project', () => {
    const onConvertToAction = vi.fn();
    setup({ actions: [], subProjects: [], onConvertToAction });
    fireEvent.click(screen.getByRole('button', { name: 'Convert to action' }));
    expect(onConvertToAction).toHaveBeenCalled();
  });

  it('toggles the "Add to project" panel and hides its controls when collapsed', () => {
    const onToggleAddPanel = vi.fn();
    setup({ onToggleAddPanel });
    // Expanded by default: the controls are visible and the header reports it.
    expect(screen.getByLabelText('Add action')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to project' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Add to project' }));
    expect(onToggleAddPanel).toHaveBeenCalled();
  });

  it('hides the add controls when the panel is collapsed', () => {
    setup({ addPanelCollapsed: true });
    expect(screen.queryByLabelText('Add action')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Add sub-project')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to project' })).toHaveAttribute('aria-expanded', 'false');
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
