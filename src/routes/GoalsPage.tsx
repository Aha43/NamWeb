import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizeTags } from '@/domain/mutations';
import { GoalBoardsPanel } from '@/features/goals/GoalBoardsPanel';
import { missionControlStations } from '@/features/goals/goalBoards';
import { useWorkspaceContext } from '@/store/workspace-context';

export function GoalsPage() {
  const { document, dispatch } = useWorkspaceContext();
  const navigate = useNavigate();
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const boards = document?.missionControls ?? [];
  const selected = boards.find((b) => b.name === selectedName) ?? null;
  const stations = document && selected ? missionControlStations(document, selected) : [];

  return (
    <GoalBoardsPanel
      boards={boards}
      selected={selected}
      stations={stations}
      onCreate={(name, tags) => {
        dispatch({ type: 'createMissionControl', name, tags: normalizeTags(tags) });
        setSelectedName(name);
      }}
      onSelect={(board) => setSelectedName(board.name)}
      onDelete={(name) => {
        dispatch({ type: 'deleteMissionControl', name });
        if (selectedName === name) setSelectedName(null);
      }}
      onOpenProject={(id) => navigate(`/projects/${id}`)}
    />
  );
}
