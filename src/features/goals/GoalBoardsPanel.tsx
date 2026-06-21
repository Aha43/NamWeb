import { useState, type FormEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { heatBorderClass, type MissionStat } from '../projects/missionStats';
import type { MissionControl } from '../../domain/types';

export interface GoalBoardsPanelProps {
  boards: MissionControl[];
  selected: MissionControl | null;
  stations: MissionStat[];
  onCreate: (name: string, tags: string[]) => void;
  onSelect: (board: MissionControl) => void;
  onDelete: (name: string) => void;
  onOpenProject: (id: string) => void;
}

/** Goal Boards: tag-grouped project dashboards. Presentational. */
export function GoalBoardsPanel({
  boards,
  selected,
  stations,
  onCreate,
  onSelect,
  onDelete,
  onOpenProject,
}: GoalBoardsPanelProps) {
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    const parsed = tags.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
    if (!trimmed || parsed.length === 0) return;
    onCreate(trimmed, parsed);
    setName('');
    setTags('');
  }

  return (
    <section className="space-y-4">
      <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-card p-3">
        <input
          aria-label="Board name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New goal board…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
        />
        <div className="flex gap-2">
          <input
            aria-label="Board tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tags (space or comma)"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
          />
          <Button type="submit" size="sm">Create</Button>
        </div>
      </form>

      {boards.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No goal boards yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {boards.map((board) => (
            <li key={board.name} className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                aria-label={`Open board ${board.name}`}
                onClick={() => onSelect(board)}
                className={cn(
                  'flex-1 truncate text-left text-sm hover:underline',
                  selected?.name === board.name ? 'font-semibold text-foreground' : 'text-foreground',
                )}
              >
                {board.name}
                <span className="text-xs text-muted-foreground"> · {board.tags.join(', ')}</span>
              </button>
              <button
                type="button"
                aria-label={`Delete board ${board.name}`}
                onClick={() => onDelete(board.name)}
                className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="space-y-1">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {selected.name}
          </p>
          {stations.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No matching projects.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {stations.map((stat) => (
                <button
                  key={stat.id}
                  type="button"
                  aria-label={`Open ${stat.title}`}
                  onClick={() => onOpenProject(stat.id)}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border-2 bg-card p-3 text-left hover:bg-accent',
                    heatBorderClass(stat),
                  )}
                >
                  <span className="truncate text-sm font-medium text-foreground">{stat.title}</span>
                  <span className="flex items-center justify-between text-xs text-muted-foreground">
                    {stat.total === 0 ? 'no actions' : `${stat.done}/${stat.total} done`}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
