import { useState, type FormEvent } from 'react';
import { ChevronRight, LayoutDashboard, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ActionList, ActionRow } from '../actions/ActionRow';
import { StatusMenu } from '../actions/StatusMenu';
import type { ActionRowData } from '../actions/rows';
import type { MissionStat } from './missionStats';
import type { NamNode, NodeStatus } from '../../domain/types';

function ratioTone(ratio: number): string {
  if (ratio < 0.34) return 'border-red-500/60';
  if (ratio < 0.67) return 'border-amber-500/60';
  return 'border-green-500/60';
}

export interface ProjectWorkbenchProps {
  project: NamNode;
  /** Ancestor projects, top-most first (excludes the current project). */
  breadcrumb: NamNode[];
  actions: ActionRowData[];
  subProjects: NamNode[];
  subProjectStats?: MissionStat[];
  onOpenProject: (id: string) => void;
  onOpenProjects: () => void;
  onAddAction: (title: string) => void;
  onAddSubProject: (title: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit: (id: string) => void;
  onRename: (id: string, title: string) => void;
  /** Provided only when the project is a leaf (no children) — convert it back to an action. */
  onConvertToAction?: () => void;
}

/** A project's workbench: breadcrumb, its direct actions, and its sub-project sections. */
export function ProjectWorkbench({
  project,
  breadcrumb,
  actions,
  subProjects,
  subProjectStats,
  onOpenProject,
  onOpenProjects,
  onAddAction,
  onAddSubProject,
  onSetStatus,
  onEdit,
  onRename,
  onConvertToAction,
}: ProjectWorkbenchProps) {
  const [heatmap, setHeatmap] = useState(false);
  return (
    <section className="mx-auto max-w-md space-y-4">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <button type="button" onClick={onOpenProjects} className="hover:text-foreground">
          Projects
        </button>
        {breadcrumb.map((ancestor) => (
          <span key={ancestor.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <button type="button" onClick={() => onOpenProject(ancestor.id)} className="hover:text-foreground">
              {ancestor.title}
            </button>
          </span>
        ))}
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">{project.title}</span>
      </nav>

      <div className="space-y-2">
        <QuickAdd label="Add action" placeholder="Add an action…" onAdd={onAddAction} />
        <QuickAdd label="Add sub-project" placeholder="Add a sub-project…" onAdd={onAddSubProject} />
      </div>

      {actions.length > 0 && (
        <ActionList>
          {actions.map((row) => (
            <ActionRow
              key={row.id}
              row={row}
              onEdit={() => onEdit(row.id)}
              onRename={(title) => onRename(row.id, title)}
              actions={
                <StatusMenu
                  status={row.status}
                  title={row.title}
                  onSetStatus={(status) => onSetStatus(row.id, status)}
                />
              }
            />
          ))}
        </ActionList>
      )}

      {subProjects.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sub-projects</p>
            {subProjectStats && (
              <button
                type="button"
                aria-label={heatmap ? 'Show sub-projects as a list' : 'Show sub-projects as a heat-map'}
                onClick={() => setHeatmap((on) => !on)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {heatmap ? <List className="h-3.5 w-3.5" /> : <LayoutDashboard className="h-3.5 w-3.5" />}
                {heatmap ? 'List' : 'Heat-map'}
              </button>
            )}
          </div>

          {heatmap && subProjectStats ? (
            <div className="grid grid-cols-2 gap-2">
              {subProjectStats.map((stat) => (
                <button
                  key={stat.id}
                  type="button"
                  aria-label={`Open ${stat.title}`}
                  onClick={() => onOpenProject(stat.id)}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border-2 bg-card p-3 text-left hover:bg-accent',
                    ratioTone(stat.ratio),
                  )}
                >
                  <span className="truncate text-sm font-medium text-foreground">{stat.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {stat.done}/{stat.total} done
                    {stat.subProjectCount > 0 && ` · ${stat.subProjectCount} sub`}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {subProjects.map((sub) => (
                <li key={sub.id}>
                  <button
                    type="button"
                    aria-label={`Open ${sub.title}`}
                    onClick={() => onOpenProject(sub.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                  >
                    <span className="flex-1 truncate text-sm text-foreground">{sub.title}</span>
                    {sub.childIds.length > 0 && (
                      <span className="text-xs text-muted-foreground">{sub.childIds.length}</span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {actions.length === 0 && subProjects.length === 0 && (
        <div className="space-y-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">Nothing here yet — add an action or a sub-project.</p>
          {onConvertToAction && (
            <Button type="button" variant="outline" size="sm" onClick={onConvertToAction}>
              Convert to action
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function QuickAdd({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        aria-label={label}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
      />
      <Button type="submit" variant="outline" size="sm">
        Add
      </Button>
    </form>
  );
}
