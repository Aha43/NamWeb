import { useWorkspaceContext } from '@/store/workspace-context';

/** Transient cross-surface sync notice (conflict reloaded / sync failed). */
export function SyncNotice() {
  const ws = useWorkspaceContext();
  if (!ws.notice) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      <span>{ws.notice}</span>
      <button type="button" onClick={ws.clearNotice} className="font-medium hover:underline">
        Dismiss
      </button>
    </div>
  );
}
