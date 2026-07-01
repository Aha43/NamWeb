import { useTranslation } from 'react-i18next';
import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import { StatusMenu } from '../actions/StatusMenu';
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
  if (groups.length === 0) {
    return (
      <section>
        <EmptyState hint={t('blocked.emptyHint')}>{t('blocked.empty')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-4">
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
                onEdit={onEdit && (() => onEdit(row.id))}
                onDelete={onDelete && (() => onDelete(row.id))}
                onRename={onRename && ((title) => onRename(row.id, title))}
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
        </div>
      ))}
    </section>
  );
}
