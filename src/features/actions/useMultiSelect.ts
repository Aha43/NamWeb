import { useState } from 'react';

/**
 * Shared multi-select state for list surfaces (#921) — a select mode + a set of picked ids, with the
 * toggle / select-all / clear / exit helpers every list needs. Extracted so Next / Backlog / Due /
 * Tag-filter / Blocked / Search all get the same behaviour instead of each rolling its own (as Inbox,
 * Done, and the workbench historically did). Pair with {@link SelectToggle} and {@link BulkActionsBar}.
 */
export function useMultiSelect() {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clear = () => setSelected(new Set());
  const selectAll = (ids: string[]) => setSelected(new Set(ids));
  const exit = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const enter = () => setSelectMode(true);

  return { selectMode, selected, toggle, clear, selectAll, enter, exit };
}
