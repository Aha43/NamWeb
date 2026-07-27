import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderInput } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { PromptButton } from '@/components/ui/prompt-button';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';
import { actionMoveTargetsAll, allTags } from '@/domain/lenses';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useSetStatuses } from './useSetStatus';
import { useDeleteNodes } from './useDeleteNode';
import { useSettings } from '@/components/settings/settings-context';
import { newId, nowIso } from '@/lib/local';
import type { NodeStatus } from '@/domain/types';

/**
 * The bulk-action bar for any list's select mode (#921) — tag / status / move / delete over the
 * selected ids, plus select-all / clear. Self-contained (reads the workspace + the bulk hooks
 * itself), so a list only has to own the selection state and drop this in. Each op clears the
 * selection but stays in select mode, so you can carve the next batch.
 */
export function BulkActionsBar({
  ids,
  allIds,
  onSelectAll,
  onClear,
}: {
  /** The currently selected ids. */
  ids: string[];
  /** Every selectable id in the list (for "select all"). */
  allIds: string[];
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const { document, dispatch } = useWorkspaceContext();
  const { addToBottom } = useSettings();
  const setStatuses = useSetStatuses();
  const deleteNodes = useDeleteNodes();
  const [moveOpen, setMoveOpen] = useState(false);
  // Create a project on the spot from the move picker (#970) — same as the editor/workbench pickers;
  // the new id is returned and the picker moves the selection into it.
  const createProject = (parentId: string | null, title: string): string => {
    if (!document) return '';
    const id = newId();
    dispatch({ type: 'addSubProject', parentId: parentId ?? document.projectsNodeId, id, title, atTop: !addToBottom, now: nowIso() });
    return id;
  };
  // Act only on selections that are still on screen. A query / tag-filter / realtime change can leave
  // picked ids that have dropped out of the list, and we must never tag/move/delete an off-screen node
  // (#921 review, P1). `allIds` is exactly the currently-rendered set for whichever view hosts us.
  const visible = new Set(allIds);
  const targetIds = ids.filter((id) => visible.has(id));
  const none = targetIds.length === 0;

  // Tag and status KEEP the selection (#936): the rows stay put, so you can tag then set status, or
  // apply several tags, without reselecting. (In a status-filtered list a status change removes the
  // rows from view — they then intersect out of `targetIds` on the next render, which is correct.)
  const bulkTag = (tag: string) => {
    const clean = tag.trim();
    if (!clean) return;
    const now = nowIso();
    for (const id of targetIds) {
      const node = document?.nodes[id];
      if (node) dispatch({ type: 'updateTags', id, tags: [...node.tags, clean], now }); // normalized in the reducer
    }
  };
  const bulkStatus = (status: NodeStatus) => {
    setStatuses(targetIds, status);
  };
  // Move and delete DO clear — the items leave the current list, so keeping them selected is meaningless.
  const bulkMove = (targetId: string) => {
    const now = nowIso();
    for (const id of targetIds) dispatch({ type: 'moveNode', id, newParentId: targetId, now });
    onClear();
  };
  const bulkDelete = () => {
    deleteNodes(targetIds);
    onClear();
  };

  // The move destinations are the same set every action can go to (all projects + Free actions);
  // moveNode guards a nonsensical target, so the first selected item's targets stand in for all.
  const moveTargets = document && targetIds[0] ? actionMoveTargetsAll(document, targetIds[0]) : [];
  // Tag suggestions from the workspace — WITHOUT these the tag popover has no list, and the browser's
  // own autofill (contacts!) fills the void (#921 fix).
  const tagSuggestions = document ? allTags(document) : [];

  const opClass =
    'rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
      <span className="mr-1 text-muted-foreground">{t('actions.selectedCount', { count: targetIds.length })}</span>

      <PromptButton
        aria-label={t('list.bulkTagAria')}
        label={t('list.bulkTag')}
        placeholder={t('list.bulkTagPlaceholder')}
        submitLabel={t('common.add')}
        suggestions={tagSuggestions}
        onSubmit={bulkTag}
        disabled={none}
        className={opClass}
      >
        {t('list.bulkTag')}
      </PromptButton>

      <DropdownMenu>
        <DropdownMenuTrigger disabled={none} className={opClass}>
          {t('workbench.statusMenu')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => bulkStatus('NEXT')}>{t('domain.status.next')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => bulkStatus('BACKLOG')}>{t('domain.status.backlog')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => bulkStatus('DONE')}>{t('domain.status.done')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button type="button" onClick={() => setMoveOpen(true)} disabled={none} className={`${opClass} inline-flex items-center gap-1`}>
        <FolderInput className="h-3.5 w-3.5" />
        {t('list.moveTo')}
      </button>
      <ProjectPickerDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={t('list.moveTo')}
        confirmLabel={t('common.choose')}
        targets={moveTargets}
        onConfirm={bulkMove}
        onCreateProject={createProject}
      />

      <ConfirmButton
        aria-label={t('list.deleteSelectedAria')}
        message={t('inbox.deleteSelectedConfirm', { count: targetIds.length })}
        onConfirm={bulkDelete}
        disabled={none}
        className="rounded-md px-2 py-0.5 font-medium text-destructive hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
      >
        {t('common.delete')}
      </ConfirmButton>

      <button
        type="button"
        onClick={onSelectAll}
        disabled={targetIds.length === allIds.length}
        className="ml-auto rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        {t('common.selectAll')}
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={none}
        className="rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        {t('common.clear')}
      </button>
    </div>
  );
}
