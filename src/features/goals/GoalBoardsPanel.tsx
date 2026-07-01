import { useState, type FormEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    const parsed = tags.split(/[,\s]+/).map((tag) => tag.trim()).filter(Boolean);
    if (!trimmed || parsed.length === 0) return;
    onCreate(trimmed, parsed);
    setName('');
    setTags('');
  }

  return (
    <section className="space-y-4">
      <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-card p-3">
        <input
          aria-label={t('goals.boardNameAria')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('goals.newBoardPlaceholder')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
        />
        <div className="flex gap-2">
          <input
            aria-label={t('goals.boardTagsAria')}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t('goals.boardTagsPlaceholder')}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
          />
          <Button type="submit" size="sm">{t('common.create')}</Button>
        </div>
      </form>

      {boards.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{t('goals.emptyTitle')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t('goals.emptyHint')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {boards.map((board) => (
            <li key={board.name} className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                aria-label={t('goals.openBoardAria', { name: board.name })}
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
                aria-label={t('goals.deleteBoardAria', { name: board.name })}
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
            <p className="py-6 text-center text-sm text-muted-foreground">{t('goals.noMatching')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {stations.map((stat) => (
                <button
                  key={stat.id}
                  type="button"
                  aria-label={t('column.openAria', { title: stat.title })}
                  onClick={() => onOpenProject(stat.id)}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border-2 bg-card p-3 text-left hover:bg-accent',
                    heatBorderClass(stat),
                  )}
                >
                  <span className="truncate text-sm font-medium text-foreground">{stat.title}</span>
                  <span className="flex items-center justify-between text-xs text-muted-foreground">
                    {stat.total === 0 ? t('workbench.noActions') : t('workbench.doneCount', { done: stat.done, total: stat.total })}
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
