import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/store/workspace-context';

/**
 * Cross-surface sync notice. `info` (amber) reports a benign reconcile and auto-dismisses; `error`
 * (red) means a change didn't reach the server — it stays put and offers **Retry**, so a local-only
 * edit never reads as saved.
 */
export function SyncNotice() {
  const { t } = useTranslation();
  const ws = useWorkspaceContext();
  if (!ws.notice) return null;
  const isError = ws.notice.kind === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2 text-sm',
        isError
          ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
          : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
      )}
    >
      <span className="min-w-0">{ws.notice.raw ?? t(ws.notice.messageKey)}</span>
      <div className="flex shrink-0 items-center gap-3">
        {isError && (
          <button type="button" onClick={ws.retrySync} className="font-medium hover:underline">
            {t('sync.retry')}
          </button>
        )}
        <button type="button" onClick={ws.clearNotice} className="font-medium hover:underline">
          {t('sync.dismiss')}
        </button>
      </div>
    </div>
  );
}
