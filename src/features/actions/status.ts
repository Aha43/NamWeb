// Shared status presentation: the choosable statuses (menu order), their translation keys, and
// the text tones. One place instead of per-surface copies (StatusMenu / ActionDialog /
// ProjectDetailsPanel / the undo toasts), so adding or renaming a status can't drift (#582).
import type { TFunction } from 'i18next';
import type { NodeStatus } from '@/domain/types';

/** The user-choosable statuses, in menu order, with their `domain.*` label keys. */
export const STATUS_OPTIONS: { value: NodeStatus; label: string }[] = [
  { value: 'NEXT', label: 'domain.status.next' },
  { value: 'BACKLOG', label: 'domain.status.backlog' },
  // SOMEDAY (#1131): a parking state between "do later" and "done" — commitment, not timing.
  { value: 'SOMEDAY', label: 'domain.status.someday' },
  { value: 'DONE', label: 'domain.status.done' },
];

/** The translated status name — falls back to the raw enum for statuses without a key. */
export function statusLabel(t: TFunction, status: NodeStatus): string {
  return t(`domain.status.${status.toLowerCase()}`, { defaultValue: status });
}

/** Status → text color. Shared so the badge and the action-title coloring (ActionRow) stay in sync. */
export const STATUS_TEXT_TONE: Partial<Record<NodeStatus, string>> = {
  NEXT: 'text-primary',
  BACKLOG: 'text-muted-foreground',
  SOMEDAY: 'text-muted-foreground', // parked and quiet, like backlog — it's "not now" work
  DONE: 'text-green-600 dark:text-green-400',
};
