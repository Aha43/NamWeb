import { useTranslation } from 'react-i18next';
import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import { StatusMenu } from '../actions/StatusMenu';
import { SelectToggle } from '../actions/SelectToggle';
import { BulkActionsBar } from '../actions/BulkActionsBar';
import { useMultiSelect } from '../actions/useMultiSelect';
import type { ActionRowData } from '../actions/rows';
import type { NodeStatus } from '../../domain/types';

export interface BlockedRowGroup {
  blocker: { id: string; title: string };
  rows: ActionRowData[];
}

export interface BlockedPanelProps {
  groups: BlockedRowGroup[];
  onOpenBlocker: (id: string) => void;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit?: (id: string) => void;
  /** Inline delete (with confirm) per row. */
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
}

/** Blocked actions grouped under each active prerequisite. Presentational. */
export function BlockedPanel({ groups, onOpenBlocker, onSetStatus, onEdit, onDelete, onRename }: BlockedPanelProps) {
  const { t } = useTranslation();
  const { selectMode, selected, toggle, clear, selectAll, enter, exit } = useMultiSelect();
  // An action can sit under several blockers — dedupe so counts / select-all are honest.
  const allRowIds = [...new Set(groups.flatMap((g) => g.rows.map((r) => r.id)))];
  if (groups.length === 0) {
    return (
      <section>
        <EmptyState hint={t('blocked.emptyHint')}>{t('blocked.empty')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="sticky top-0 z-10 space-y-2 bg-background pt-1">
        <div className="flex items-center justify-end">
          <SelectToggle active={selectMode} onToggle={() => (selectMode ? exit() : enter())} />
        </div>
        {selectMode && (
          <BulkActionsBar ids={[...selected]} allIds={allRowIds} onSelectAll={() => selectAll(allRowIds)} onClear={clear} />
        )}
      </div>
      {groups.map((group) => (
        <div key={group.blocker.id} className="space-y-1">
          <button
            type="button"
            aria-label={t('blocked.openBlockerAria', { title: group.blocker.title })}
            onClick={() => onOpenBlocker(group.blocker.id)}
            className="px-1 text-left text-xs font-semibold text-foreground hover:underline"
          >
            {t('blocked.blockedBy', { title: group.blocker.title })}
          </button>
          <ActionList>
            {group.rows.map((row) => (
              <ActionRow
                key={row.id}
                row={row}
                selectable={selectMode}
                selected={selected.has(row.id)}
                onSelectedChange={() => toggle(row.id)}
                onEdit={selectMode ? undefined : onEdit && (() => onEdit(row.id))}
                onDelete={selectMode ? undefined : onDelete && (() => onDelete(row.id))}
                onRename={selectMode ? undefined : onRename && ((title) => onRename(row.id, title))}
                actions={
                  selectMode ? null : (
                    <StatusMenu
                      status={row.status}
                      title={row.title}
                      onSetStatus={(status) => onSetStatus(row.id, status)}
                    />
                  )
                }
              />
            ))}
          </ActionList>
        </div>
      ))}
    </section>
  );
}
