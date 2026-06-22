import { Fragment, useRef, useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, ChevronRight, FolderInput, Pencil, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SortableList } from '@/components/dnd/SortableList';
import { SortableRow, type SortableRowRender } from '@/components/dnd/SortableRow';
import { InlineRename } from '../actions/InlineRename';
import { ReorderControls } from '../actions/ReorderControls';
import type { NamNode } from '../../domain/types';

/** A project the row can be moved into (made a sub-project of). */
export interface MoveTarget {
  id: string;
  label: string;
}

export interface ProjectsPanelProps {
  projects: NamNode[];
  onAdd: (title: string) => void;
  onOpen: (id: string) => void;
  /** Inline-rename a project (deliberate, via the rename button — no dialog). */
  onRename?: (id: string, title: string) => void;
  /** Persist a new top-level order (up/down buttons + desktop drag). Gets the full id order. */
  onReorder?: (orderedIds: string[]) => void;
  /** Mount drag-and-drop (desktop). The up/down buttons are the always-on fallback. */
  dndEnabled?: boolean;
  /** Candidate projects to move `id` into (siblings first), excluding itself + its subtree. */
  moveTargets?: (id: string) => MoveTarget[];
  /** Make `id` a sub-project of `targetId`. */
  onMoveInto?: (id: string, targetId: string) => void;
  /** Seed the hands-on "Learn NAM" onboarding project (also a safe demo — delete to tidy up). */
  onAddLearnNam?: () => void;
  /** Import a workspace JSON export under a new timestamped project. Returns an error to show. */
  onImportWorkspace?: (json: string) => { ok: boolean; error?: string };
  /** Archive / unarchive a project (declutter the list using the ARCHIVED status). */
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  /** "Show archived" toggle state + count of hidden archived projects. */
  showArchived?: boolean;
  onToggleShowArchived?: () => void;
  archivedCount?: number;
}

/** Top-level projects: quick-add plus the list, each opening into the workbench. Presentational. */
export function ProjectsPanel({
  projects,
  onAdd,
  onOpen,
  onRename,
  onReorder,
  dndEnabled,
  moveTargets,
  onMoveInto,
  onAddLearnNam,
  onImportWorkspace,
  onArchive,
  onUnarchive,
  showArchived,
  onToggleShowArchived,
  archivedCount = 0,
}: ProjectsPanelProps) {
  const [title, setTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-importing the same file
    if (!file || !onImportWorkspace) return;
    setImportError(null);
    const text = await file.text();
    const result = onImportWorkspace(text);
    if (!result.ok) setImportError(result.error ?? 'Import failed.');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }

  const ids = projects.map((p) => p.id);
  const dnd = Boolean(dndEnabled && onReorder && projects.length > 1);

  // Up/down: swap a project with its neighbour and persist the whole new order.
  function move(index: number, direction: 'up' | 'down') {
    if (!onReorder) return;
    const j = direction === 'up' ? index - 1 : index + 1;
    if (j < 0 || j >= ids.length) return;
    const order = [...ids];
    [order[index], order[j]] = [order[j], order[index]];
    onReorder(order);
  }

  // One project row; `drag` is supplied when rendered inside a SortableContext.
  const renderRow = (project: NamNode, index: number, drag?: SortableRowRender) => {
    const isArchived = project.status === 'ARCHIVED';
    const targets = onMoveInto && !isArchived && moveTargets ? moveTargets(project.id) : [];
    return (
    <li
      ref={drag?.setNodeRef}
      style={drag?.style}
      className={`flex items-center gap-1 pr-2 transition-colors even:bg-muted/40 hover:bg-accent/40${isArchived ? ' opacity-60' : ''}`}
    >
      {renamingId === project.id && onRename ? (
        <div className="flex-1 px-3 py-2">
          <InlineRename
            title={project.title}
            onCommit={(t) => { onRename(project.id, t); setRenamingId(null); }}
            onCancel={() => setRenamingId(null)}
          />
        </div>
      ) : (
        <>
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
          {onArchive && !isArchived && (
            <Tooltip label="Archive">
              <button
                type="button"
                aria-label={`Archive ${project.title}`}
                onClick={() => onArchive(project.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {onUnarchive && isArchived && (
            <Tooltip label="Unarchive">
              <button
                type="button"
                aria-label={`Unarchive ${project.title}`}
                onClick={() => onUnarchive(project.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {onMoveInto && targets.length > 0 && (
            <DropdownMenu>
              <Tooltip label="Move into another project">
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Move ${project.title} into another project`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                {targets.map((t) => (
                  <DropdownMenuItem key={t.id} onSelect={() => onMoveInto(project.id, t.id)}>
                    {t.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!isArchived && drag?.handle}
          {onReorder && !isArchived && (
            <ReorderControls
              title={project.title}
              onUp={index > 0 ? () => move(index, 'up') : undefined}
              onDown={index < projects.length - 1 ? () => move(index, 'down') : undefined}
            />
          )}
        </>
      )}
    </li>
    );
  };

  return (
    <section className="space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <input
          aria-label="Add project"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New project…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
        />
        <Button type="submit">Add</Button>
      </form>

      {(onImportWorkspace ||
        (archivedCount > 0 && onToggleShowArchived) ||
        (onAddLearnNam && projects.length > 0)) && (
        <div className="flex items-center justify-end gap-2">
          {onImportWorkspace && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                className="hidden"
                aria-label="Workspace JSON file"
                onChange={onImportFile}
              />
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => fileInput.current?.click()}>
                <Upload className="h-4 w-4" />
                Import workspace…
              </Button>
            </>
          )}
          {archivedCount > 0 && onToggleShowArchived && (
            <Button type="button" variant="ghost" size="sm" onClick={onToggleShowArchived}>
              {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
            </Button>
          )}
          {onAddLearnNam && projects.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={onAddLearnNam}>
              Add Learn NAM 🥋
            </Button>
          )}
        </div>
      )}
      {importError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {importError}
        </p>
      )}

      {projects.length === 0 ? (
        <div className="space-y-2 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No projects yet</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Group related actions into a project — plan bigger outcomes with sub-projects, a
            workbench, and progress at a glance.
          </p>
          {onAddLearnNam && (
            <p className="text-sm text-muted-foreground">
              New to NAM?{' '}
              <button type="button" onClick={onAddLearnNam} className="font-medium text-primary hover:underline">
                Add the Learn NAM project 🥋
              </button>{' '}
              and learn by doing.
            </p>
          )}
        </div>
      ) : (
        <SortableList ids={ids} onReorder={onReorder ?? (() => {})} disabled={!dnd}>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {projects.map((project, index) =>
              dnd ? (
                <SortableRow key={project.id} id={project.id} label={project.title}>
                  {(drag) => renderRow(project, index, drag)}
                </SortableRow>
              ) : (
                <Fragment key={project.id}>{renderRow(project, index)}</Fragment>
              ),
            )}
          </ul>
        </SortableList>
      )}
    </section>
  );
}
