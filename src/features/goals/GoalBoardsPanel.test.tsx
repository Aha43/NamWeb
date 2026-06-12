import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MissionControl } from '../../domain/types';
import type { MissionStat } from '../projects/missionStats';
import { GoalBoardsPanel } from './GoalBoardsPanel';

function setup(over: Partial<React.ComponentProps<typeof GoalBoardsPanel>> = {}) {
  const handlers = { onCreate: vi.fn(), onSelect: vi.fn(), onDelete: vi.fn(), onOpenProject: vi.fn() };
  render(
    <GoalBoardsPanel boards={[]} selected={null} stations={[]} {...handlers} {...over} />,
  );
  return handlers;
}

describe('GoalBoardsPanel', () => {
  it('creates a board from name + parsed tags', () => {
    const { onCreate } = setup();
    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'Q3 goals' } });
    fireEvent.change(screen.getByLabelText('Board tags'), { target: { value: 'home, urgent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onCreate).toHaveBeenCalledWith('Q3 goals', ['home', 'urgent']);
  });

  it('lists boards and opens a selected board to its stations', () => {
    const board: MissionControl = { name: 'Goals', tags: ['goal'] };
    const station: MissionStat = { id: 'p', title: 'Roadmap', subProjectCount: 0, done: 1, total: 4, ratio: 0.25 };
    const { onSelect, onOpenProject } = setup({ boards: [board], selected: board, stations: [station] });
    fireEvent.click(screen.getByRole('button', { name: 'Open board Goals' }));
    expect(onSelect).toHaveBeenCalledWith(board);
    expect(screen.getByText('1/4 done')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Roadmap' }));
    expect(onOpenProject).toHaveBeenCalledWith('p');
  });
});
