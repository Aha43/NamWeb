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
import { actionMoveTargetsAll } from '@/domain/lenses';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useSetStatuses } from './useSetStatus';
import { useDeleteNodes } from './useDeleteNode';
import { nowIso } from '@/lib/local';
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
  const setStatuses = useSetStatuses();
  const deleteNodes = useDeleteNodes();
  const [moveOpen, setMoveOpen] = useState(false);
  const none = ids.length === 0;

  const bulkTag = (tag: string) => {
    const clean = tag.trim();
    if (!clean) return;
    const now = nowIso();
    for (const id of ids) {
      const node = document?.nodes[id];
      if (node) dispatch({ type: 'updateTags', id, tags: [...node.tags, clean], now }); // normalized in the reducer
    }
    onClear();
  };
  const bulkStatus = (status: NodeStatus) => {
    setStatuses(ids, status);
    onClear();
  };
  const bulkMove = (targetId: string) => {
    const now = nowIso();
    for (const id of ids) dispatch({ type: 'moveNode', id, newParentId: targetId, now });
    onClear();
  };
  const bulkDelete = () => {
    deleteNodes(ids);
    onClear();
  };

  // The move destinations are the same set every action can go to (all projects + Free actions);
  // moveNode guards a nonsensical target, so the first selected item's targets stand in for all.
  const moveTargets = document && ids[0] ? actionMoveTargetsAll(document, ids[0]) : [];

  const opClass =
    'rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
      <span className="mr-1 text-muted-foreground">{t('actions.selectedCount', { count: ids.length })}</span>

      <PromptButton
        aria-label={t('list.bulkTagAria')}
        label={t('list.bulkTag')}
        placeholder={t('list.bulkTagPlaceholder')}
        submitLabel={t('common.add')}
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
      />

      <ConfirmButton
        aria-label={t('list.deleteSelectedAria')}
        message={t('inbox.deleteSelectedConfirm', { count: ids.length })}
        onConfirm={bulkDelete}
        disabled={none}
        className="rounded-md px-2 py-0.5 font-medium text-destructive hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
      >
        {t('common.delete')}
      </ConfirmButton>

      <button
        type="button"
        onClick={onSelectAll}
        disabled={ids.length === allIds.length}
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
