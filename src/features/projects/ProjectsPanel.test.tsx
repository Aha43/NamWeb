import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode } from '../../domain/types';
import { ProjectsPanel } from './ProjectsPanel';

function project(id: string, title: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title, description: null, status: 'BACKLOG', project: true,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

function setup(projects: NamNode[] = []) {
  const handlers = { onAdd: vi.fn(), onOpen: vi.fn() };
  render(<ProjectsPanel projects={projects} {...handlers} />);
  return handlers;
}

describe('ProjectsPanel', () => {
  it('shows the empty state with no projects', () => {
    setup([]);
    expect(screen.getByText('No projects yet.')).toBeInTheDocument();
  });

  it('adds a trimmed project and clears the field', () => {
    const { onAdd } = setup();
    const input = screen.getByLabelText('Add project');
    fireEvent.change(input, { target: { value: '  Kitchen reno  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('Kitchen reno');
    expect(input).toHaveValue('');
  });

  it('opens a project by id', () => {
    const { onOpen } = setup([project('p', 'Kitchen reno', { tags: ['home'], childIds: ['x', 'y'] })]);
    fireEvent.click(screen.getByRole('button', { name: 'Open Kitchen reno' }));
    expect(onOpen).toHaveBeenCalledWith('p');
  });
});
