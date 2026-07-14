import { useState } from 'react';
import type { NodeStatus } from '@/domain/types';

/** The three filterable statuses (#766) — session-local include-boxes on list views. */
export type StatusBoxes = { NEXT: boolean; BACKLOG: boolean; DONE: boolean };
export const STATUS_BOX_KEYS = ['NEXT', 'BACKLOG', 'DONE'] as const;

/** Session state for a view's boxes; defaults preserve the view exactly as it was. The third
 *  element says whether the boxes still MATCH those defaults — the phone Filter chip wears a
 *  dot when they don't (#786/F3: a silently-narrower list must carry a tell). */
export function useStatusBoxes(
  defaults: Partial<StatusBoxes>,
): [StatusBoxes, (s: keyof StatusBoxes) => void, boolean] {
  const resolved: StatusBoxes = { NEXT: false, BACKLOG: false, DONE: false, ...defaults };
  const [boxes, setBoxes] = useState<StatusBoxes>(resolved);
  const toggle = (status: keyof StatusBoxes) => setBoxes((b) => ({ ...b, [status]: !b[status] }));
  const isDefault = STATUS_BOX_KEYS.every((k) => boxes[k] === resolved[k]);
  return [boxes, toggle, isDefault];
}

/** The checked statuses as a list (for the lens unions). */
export function checkedStatuses(boxes: StatusBoxes): NodeStatus[] {
  return STATUS_BOX_KEYS.filter((k) => boxes[k]);
}
