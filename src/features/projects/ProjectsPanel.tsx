import { Fragment, useRef, useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, ChevronRight, FolderInput, Pencil, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { AddPositionToggle } from '@/components/settings/AddPositionToggle';
import { CopyButton } from '@/components/ui/copy-button';
import { Tooltip } from '@/components/ui/tooltip';
import { TruncatedTitle } from '@/components/ui/truncated-title';
import { descriptionTooltip } from '../actions/rows';
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
import { useIsDesktop } from '@/shell/useIsDesktop';
import { ProjectPickerDialog } from './picker/ProjectPickerDialog';
import { MoveTargetMenu } from './picker/MoveTargetMenu';
import type { PickerTarget } from './picker/pickerModel';
import type { QuickMoveTarget } from '@/domain/lenses';
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
  /** All projects `id` can move into (the "Browse all projects…" picker set). */
  moveTargets?: (id: string) => MoveTarget[];
  /** Proximate destinations (Top level + siblings) for the quick menu. */
  quickMoveTargets?: (id: string) => QuickMoveTarget[];
  /** Make `id` a sub-project of `targetId`. */
  onMoveInto?: (id: string, targetId: string) => void;
  /** Create a project under `parentId` (null = top level) and return its id — powers the picker's
   *  "New project here". */
  onCreateProject?: (parentId: string | null, title: string) => string;
  /** Seed the hands-on "Learn NAM" onboarding project (also a safe demo — delete to tidy up). */
  onAddLearnNam?: () => void;
  /** Import a workspace JSON export under a new timestamped project. Returns an error to show. */
  onImportWorkspace?: (json: string) => { ok: boolean; error?: string };
  /** Archive / unarchive a project (declutter the list using the ARCHIVED status). */
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  /** Delete a project — opens the advanced-delete dialog (content disposition + undo). */
  onDelete?: (id: string) => void;
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
  quickMoveTargets,
  onMoveInto,
  onCreateProject,
  onAddLearnNam,
  onImportWorkspace,
  onArchive,
  onUnarchive,
  onDelete,
  showArchived,
  onToggleShowArchived,
  archivedCount = 0,
}: ProjectsPanelProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Desktop: the Finder-style move picker (#425). Phone keeps the inline dropdown.
  const isDesktop = useIsDesktop();
  const [moveRequest, setMoveRequest] = useState<{
    title: string;
    targets: PickerTarget[];
    onConfirm: (id: string) => void;
  } | null>(null);

  async function onImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-importing the same file
    if (!file || !onImportWorkspace) return;
    setImportError(null);
    const text = await file.text();
    const result = onImportWorkspace(text);
    if (!result.ok) setImportError(result.error ?? t('projects.importFailed'));
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
    const quickTargets = onMoveInto && !isArchived && quickMoveTargets ? quickMoveTargets(project.id) : [];
    const descTip = descriptionTooltip(project.description);
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
            onCommit={(newTitle) => { onRename(project.id, newTitle); setRenamingId(null); }}
            onCancel={() => setRenamingId(null)}
          />
        </div>
      ) : (
        <>
          <Tooltip label={descTip}>
          <button
            type="button"
            aria-label={t('column.openAria', { title: project.title })}
            onClick={() => onOpen(project.id)}
            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-accent"
          >
            <span className="min-w-0 flex-1">
              {descTip ? (
                <span className="block truncate text-sm text-foreground">{project.title}</span>
              ) : (
                <TruncatedTitle text={project.title} className="text-sm text-foreground" />
              )}
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
          </Tooltip>
          <CopyButton value={project.title} label={t('copy.name', { title: project.title })} className="p-1.5" />
          {onRename && (
            <Tooltip label={t('actions.renameAria', { title: project.title })}>
              <button
                type="button"
                aria-label={t('actions.renameAria', { title: project.title })}
                onClick={() => setRenamingId(project.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {onArchive && !isArchived && (
            <Tooltip label={t('projects.archive')}>
              <button
                type="button"
                aria-label={t('projects.archiveAria', { title: project.title })}
                onClick={() => onArchive(project.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {onUnarchive && isArchived && (
            <Tooltip label={t('projects.unarchive')}>
              <button
                type="button"
                aria-label={t('projects.unarchiveAria', { title: project.title })}
                onClick={() => onUnarchive(project.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {onMoveInto && targets.length > 0 && (
            isDesktop ? (
              <MoveTargetMenu
                label={t('projects.moveIntoAria', { title: project.title })}
                quickTargets={quickTargets}
                onPick={(id) => onMoveInto(project.id, id)}
                onBrowse={() =>
                  setMoveRequest({
                    title: t('editor.moveTitle', { title: project.title }),
                    targets,
                    onConfirm: (id) => onMoveInto(project.id, id),
                  })
                }
              >
                <FolderInput className="h-3.5 w-3.5" />
              </MoveTargetMenu>
            ) : (
              <DropdownMenu>
                <Tooltip label={t('projects.moveIntoTooltip')}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('projects.moveIntoAria', { title: project.title })}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                  {targets.map((target) => (
                    <DropdownMenuItem key={target.id} onSelect={() => onMoveInto(project.id, target.id)}>
                      {target.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          )}
          {onDelete && (
            <Tooltip label={t('actions.deleteAria', { title: project.title })}>
              <button
                type="button"
                aria-label={t('actions.deleteAria', { title: project.title })}
                onClick={() => onDelete(project.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
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
          aria-label={t('projects.addAria')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('picker.newProjectPlaceholder')}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
        />
        <AddPositionToggle />
        <Button type="submit">{t('common.add')}</Button>
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
                aria-label={t('projects.importFileAria')}
                onChange={onImportFile}
              />
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => fileInput.current?.click()}>
                <Upload className="h-4 w-4" />
                {t('projects.importWorkspace')}
              </Button>
            </>
          )}
          {archivedCount > 0 && onToggleShowArchived && (
            <Button type="button" variant="ghost" size="sm" onClick={onToggleShowArchived}>
              {showArchived ? t('projects.hideArchived') : t('projects.showArchived', { count: archivedCount })}
            </Button>
          )}
          {onAddLearnNam && projects.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={onAddLearnNam}>
              {t('projects.addLearnNam')}
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
          <p className="text-sm font-medium text-foreground">{t('projects.emptyTitle')}</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{t('projects.emptyHint')}</p>
          {onAddLearnNam && (
            <p className="text-sm text-muted-foreground">
              {t('projects.newToNam')}{' '}
              <button type="button" onClick={onAddLearnNam} className="font-medium text-primary hover:underline">
                {t('projects.addLearnNamLink')}
              </button>{' '}
              {t('projects.learnByDoing')}
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

      {moveRequest && (
        <ProjectPickerDialog
          open
          onOpenChange={(o) => {
            if (!o) setMoveRequest(null);
          }}
          title={moveRequest.title}
          targets={moveRequest.targets}
          onConfirm={(id) => {
            moveRequest.onConfirm(id);
            setMoveRequest(null);
          }}
          onCreateProject={onCreateProject}
        />
      )}
    </section>
  );
}
