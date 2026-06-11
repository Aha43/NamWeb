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

  it('offers convert-to-action for a leaf project', () => {
    const onConvertToAction = vi.fn();
    setup({ actions: [], subProjects: [], onConvertToAction });
    fireEvent.click(screen.getByRole('button', { name: 'Convert to action' }));
    expect(onConvertToAction).toHaveBeenCalled();
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
