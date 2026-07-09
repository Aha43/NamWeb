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
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
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

  it('still opens a project that has a description (notes ride as a hover tooltip)', () => {
    const { onOpen } = setup([project('p', 'Kitchen reno', { description: 'Full gut, 8 weeks' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Open Kitchen reno' }));
    expect(onOpen).toHaveBeenCalledWith('p');
  });

  it('shows the due hint on a dated project row (#700)', () => {
    setup([
      project('p', 'Kitchen reno', { dueAt: '2026-03-20', dueEndAt: '2026-03-22' } as Partial<NamNode>),
      project('q', 'Undated'),
    ]);
    expect(screen.getByText('Due Mar 20, 2026 – Mar 22, 2026')).toBeInTheDocument();
    expect(screen.queryAllByText(/^Due /)).toHaveLength(1); // undated rows stay clean
  });

  it('offers a copy-name button on each project row', () => {
    setup([project('p', 'Kitchen reno')]);
    expect(screen.getByRole('button', { name: 'Copy name "Kitchen reno"' })).toBeInTheDocument();
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

  it('reorders top-level projects with the up/down controls', () => {
    const onReorder = vi.fn();
    setup([project('a', 'Alpha'), project('b', 'Beta')], { onReorder });
    // First row can't go up; moving it down swaps with the next and persists the full order.
    expect(screen.getByRole('button', { name: 'Move Alpha up' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move Alpha down' }));
    expect(onReorder).toHaveBeenCalledWith(['b', 'a']);
  });

  it('moves a project into a target via the Move-into menu', () => {
    const onMoveInto = vi.fn();
    const moveTargets = vi.fn(() => [{ id: 't', label: 'Target proj' }]);
    setup([project('p', 'Kitchen reno')], { onMoveInto, moveTargets });
    // Radix opens the menu on Enter/Space/ArrowDown (reliable in jsdom).
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move Kitchen reno into another project' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Target proj' }));
    expect(moveTargets).toHaveBeenCalledWith('p');
    expect(onMoveInto).toHaveBeenCalledWith('p', 't');
  });

  it('shows no Move-into button when there are no targets', () => {
    setup([project('p', 'Kitchen reno')], { onMoveInto: vi.fn(), moveTargets: () => [] });
    expect(screen.queryByRole('button', { name: /Move Kitchen reno into another project/ })).not.toBeInTheDocument();
  });

  it('offers Learn NAM in the empty state and calls onAddLearnNam', () => {
    const onAddLearnNam = vi.fn();
    setup([], { onAddLearnNam });
    fireEvent.click(screen.getByRole('button', { name: /Add the Learn NAM project/ }));
    expect(onAddLearnNam).toHaveBeenCalled();
  });

  it('offers Learn NAM alongside existing projects too', () => {
    const onAddLearnNam = vi.fn();
    setup([project('p', 'Kitchen reno')], { onAddLearnNam });
    fireEvent.click(screen.getByRole('button', { name: 'Add Learn NAM 🥋' }));
    expect(onAddLearnNam).toHaveBeenCalled();
  });

  it('archives a project, and shows Unarchive for archived rows', () => {
    const onArchive = vi.fn();
    setup([project('p', 'Kitchen reno')], { onArchive });
    fireEvent.click(screen.getByRole('button', { name: 'Archive Kitchen reno' }));
    expect(onArchive).toHaveBeenCalledWith('p');

    const onUnarchive = vi.fn();
    setup([project('a', 'Old thing', { status: 'ARCHIVED' })], { onUnarchive });
    expect(screen.queryByRole('button', { name: 'Archive Old thing' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unarchive Old thing' }));
    expect(onUnarchive).toHaveBeenCalledWith('a');
  });

  it('toggles "show archived" when there are archived projects', () => {
    const onToggleShowArchived = vi.fn();
    setup([project('p', 'Kitchen reno')], { archivedCount: 2, onToggleShowArchived });
    fireEvent.click(screen.getByRole('button', { name: 'Show archived (2)' }));
    expect(onToggleShowArchived).toHaveBeenCalled();
  });

  it('requests delete for a project (the advanced-delete dialog then confirms)', () => {
    const onDelete = vi.fn();
    setup([project('p', 'Kitchen reno', { childIds: ['x'] })], { onDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Kitchen reno' }));
    expect(onDelete).toHaveBeenCalledWith('p');
  });
});
