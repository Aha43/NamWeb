import { useTranslation } from 'react-i18next';
import { ActionList, ActionRow, EmptyState } from '../actions/ActionRow';
import { StatusMenu } from '../actions/StatusMenu';
import type { ActionRowData } from '../actions/rows';
import type { NodeStatus } from '../../domain/types';

export interface DueRowGroups {
  overdue: ActionRowData[];
  today: ActionRowData[];
  thisWeek: ActionRowData[];
  later: ActionRowData[];
}

export interface DuePanelProps {
  groups: DueRowGroups;
  onSetStatus: (id: string, status: NodeStatus) => void;
  onEdit?: (id: string) => void;
  /** Inline delete (with confirm) per row. */
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
}

// Labels are i18n keys, translated at render.
const SECTIONS: { key: keyof DueRowGroups; label: string; tone: string }[] = [
  { key: 'overdue', label: 'due.overdue', tone: 'text-red-600 dark:text-red-400' },
  { key: 'today', label: 'due.today', tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'thisWeek', label: 'due.thisWeek', tone: 'text-blue-600 dark:text-blue-400' },
  { key: 'later', label: 'due.later', tone: 'text-muted-foreground' },
];

/** Due actions grouped by urgency; empty sections are hidden. Presentational. */
export function DuePanel({ groups, onSetStatus, onEdit, onDelete, onRename }: DuePanelProps) {
  const { t } = useTranslation();
  const total = SECTIONS.reduce((n, s) => n + groups[s.key].length, 0);
  if (total === 0) {
    return (
      <section>
        <EmptyState hint={t('due.emptyHint')}>{t('due.empty')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {SECTIONS.map((section) => {
        const rows = groups[section.key];
        if (rows.length === 0) return null;
        return (
          <div key={section.key} className="space-y-1">
            <h2 className={`px-1 text-xs font-semibold uppercase tracking-wide ${section.tone}`}>{t(section.label)}</h2>
            <ActionList>
              {rows.map((row) => (
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
        );
      })}
    </section>
  );
}
