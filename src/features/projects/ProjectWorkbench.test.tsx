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
});
