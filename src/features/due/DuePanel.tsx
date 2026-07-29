import { CompactRowsToggle } from '../actions/CompactRowsToggle';
import { ListHeaderControls } from '../actions/ListHeaderControls';
import { SelectToggle } from '../actions/SelectToggle';
import { BulkActionsBar } from '../actions/BulkActionsBar';
import { useMultiSelect } from '../actions/useMultiSelect';
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
  /** A filter is active (status boxes off-default or the in-progress filter on). Drives the phone
   *  chip's dot AND keeps the filter controls on screen when the filter empties the list (#980). */
  filtered?: boolean;
}

// Labels are i18n keys, translated at render.
const SECTIONS: { key: keyof DueRowGroups; label: string; tone: string }[] = [
  { key: 'overdue', label: 'due.overdue', tone: 'text-red-600 dark:text-red-400' },
  { key: 'today', label: 'due.today', tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'thisWeek', label: 'due.thisWeek', tone: 'text-blue-600 dark:text-blue-400' },
  { key: 'later', label: 'due.later', tone: 'text-muted-foreground' },
];

/** Due actions grouped by urgency; empty sections are hidden. Presentational. */
export function DuePanel({ groups, onSetStatus, onEdit, onDelete, onRename, focusSlot, statusSlot, filtered = false }: DuePanelProps) {
  const { t } = useTranslation();
  const { selectMode, selected, toggle, clear, selectAll, enter, exit } = useMultiSelect();
  const total = SECTIONS.reduce((n, s) => n + groups[s.key].length, 0);
  const allRowIds = SECTIONS.flatMap((s) => groups[s.key].map((r) => r.id));
  if (total === 0) {
    // A filter emptied the list: keep the controls on screen so you can adjust the filter back —
    // otherwise the status boxes vanish and you're stranded (only route out is leaving the view)
    // (#980). Only the genuine "nothing due" state (no filter active) drops to the bare empty state.
    if (filtered) {
      return (
        <section className="space-y-4">
          <div className="sticky top-0 z-10 space-y-2 bg-background pt-1">
            <ListHeaderControls filtered statusSlot={statusSlot} />
          </div>
          <EmptyState hint={t('due.filteredEmptyHint')}>{t('due.filteredEmpty')}</EmptyState>
        </section>
      );
    }
    return (
      <section>
        <EmptyState hint={t('due.emptyHint')}>{t('due.empty')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Pin the Focus entry point + select toggle so they stay reachable while the groups scroll. */}
      <div className="sticky top-0 z-10 space-y-2 bg-background pt-1">
        <ListHeaderControls
          filtered={filtered}
          statusSlot={statusSlot}
          rowsToggle={<CompactRowsToggle />}
          focusSlot={focusSlot}
          selectSlot={<SelectToggle active={selectMode} onToggle={() => (selectMode ? exit() : enter())} />}
        />
        {selectMode && (
          <BulkActionsBar ids={[...selected]} allIds={allRowIds} onSelectAll={() => selectAll(allRowIds)} onClear={clear} />
        )}
      </div>
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
        );
      })}
    </section>
  );
}
