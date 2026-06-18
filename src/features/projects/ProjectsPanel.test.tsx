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

function setup(projects: NamNode[] = [], over: Partial<React.ComponentProps<typeof ProjectsPanel>> = {}) {
  const handlers = { onAdd: vi.fn(), onOpen: vi.fn() };
  render(<ProjectsPanel projects={projects} {...handlers} {...over} />);
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

  it('inline-renames a project via the rename button (no dialog)', () => {
    const onRename = vi.fn();
    setup([project('p', 'Kitchen reno')], { onRename });
    fireEvent.click(screen.getByRole('button', { name: 'Rename Kitchen reno' }));
    const input = screen.getByLabelText('Rename Kitchen reno'); // InlineRename input
    fireEvent.change(input, { target: { value: 'Kitchen remodel' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('p', 'Kitchen remodel');
  });

  it('has no rename button when onRename is not provided', () => {
    setup([project('p', 'Kitchen reno')]);
    expect(screen.queryByRole('button', { name: 'Rename Kitchen reno' })).not.toBeInTheDocument();
  });
});
