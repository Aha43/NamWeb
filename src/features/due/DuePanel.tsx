import { CompactRowsToggle } from '../actions/CompactRowsToggle';
import { ListHeaderControls } from '../actions/ListHeaderControls';
import type { ReactNode } from 'react';
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
  /** The Focus entry point (a FocusButton) — pinned in a sticky header so it stays reachable. */
  focusSlot?: ReactNode;
  /** The status include-boxes (#766). */
  statusSlot?: ReactNode;
  /** False puts the filtered-dot on the phone chip (#786/F3). */
  boxesDefault?: boolean;
}

// Labels are i18n keys, translated at render.
const SECTIONS: { key: keyof DueRowGroups; label: string; tone: string }[] = [
  { key: 'overdue', label: 'due.overdue', tone: 'text-red-600 dark:text-red-400' },
  { key: 'today', label: 'due.today', tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'thisWeek', label: 'due.thisWeek', tone: 'text-blue-600 dark:text-blue-400' },
  { key: 'later', label: 'due.later', tone: 'text-muted-foreground' },
];

/** Due actions grouped by urgency; empty sections are hidden. Presentational. */
export function DuePanel({ groups, onSetStatus, onEdit, onDelete, onRename, focusSlot, statusSlot, boxesDefault = true }: DuePanelProps) {
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
      {/* Pin the Focus entry point so it stays reachable while the groups scroll under. */}
      {(focusSlot || statusSlot) && (
        <div className="sticky top-0 z-10 bg-background pt-1">
          <ListHeaderControls filtered={!boxesDefault} statusSlot={statusSlot} rowsToggle={<CompactRowsToggle />} focusSlot={focusSlot} />
        </div>
      )}
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
