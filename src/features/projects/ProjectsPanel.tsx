import { useState, type FormEvent } from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { InlineRename } from '../actions/InlineRename';
import type { NamNode } from '../../domain/types';

export interface ProjectsPanelProps {
  projects: NamNode[];
  onAdd: (title: string) => void;
  onOpen: (id: string) => void;
  /** Inline-rename a project (deliberate, via the rename button — no dialog). */
  onRename?: (id: string, title: string) => void;
}

/** Top-level projects: quick-add plus the list, each opening into the workbench. Presentational. */
export function ProjectsPanel({ projects, onAdd, onOpen, onRename }: ProjectsPanelProps) {
  const [title, setTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <input
          aria-label="Add project"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New project…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-ring"
        />
        <Button type="submit">Add</Button>
      </form>

      {projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {projects.map((project) =>
            renamingId === project.id && onRename ? (
              <li key={project.id} className="px-3 py-2">
                <InlineRename
                  title={project.title}
                  onCommit={(t) => { onRename(project.id, t); setRenamingId(null); }}
                  onCancel={() => setRenamingId(null)}
                />
              </li>
            ) : (
              <li key={project.id} className="flex items-center gap-1 pr-2">
                <button
                  type="button"
                  aria-label={`Open ${project.title}`}
                  onClick={() => onOpen(project.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <TruncatedTitle text={project.title} className="text-sm text-foreground" />
                    {project.tags.length > 0 && (
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {project.tags.map((tag) => (
                          <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  {project.childIds.length > 0 && (
                    <span className="text-xs text-muted-foreground">{project.childIds.length}</span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
                {onRename && (
                  <Tooltip label={`Rename ${project.title}`}>
                    <button
                      type="button"
                      aria-label={`Rename ${project.title}`}
                      onClick={() => setRenamingId(project.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
