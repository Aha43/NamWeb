import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/ui/tooltip';
import { useContext } from 'react';
import { WorkspaceContext } from '@/store/workspace-context';
import { IN_PROGRESS_TAG } from '@/domain/systemTags';
import { nowIso } from '@/lib/local';
import { cn } from '@/lib/utils';
import { TOUCH_TARGET } from '@/lib/touch';

/**
 * One-click "working on it" toggle (#651): flips the built-in **in progress** system tag on an
 * action. Self-contained (reads the live tags and dispatches itself), so any row/card can drop it
 * in without new plumbing — marking progress happens mid-work and must be friction-free.
 */
export function InProgressToggle({ id, title }: { id: string; title: string }) {
  const { t } = useTranslation();
  // Optional context: presentational hosts (and their tests) render rows without a workspace
  // provider — the toggle simply doesn't appear there.
  const workspace = useContext(WorkspaceContext);
  const node = workspace?.document?.nodes[id];
  if (!workspace || !node) return null;
  const { dispatch } = workspace;
  const on = node.tags.includes(IN_PROGRESS_TAG);
  const label = t('tags.inProgressToggleAria', { title });
  return (
    <Tooltip label={on ? t('tags.inProgressOn') : t('tags.inProgressOff')}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={on}
        onClick={() =>
          dispatch({
            type: 'updateTags',
            id,
            tags: on ? node.tags.filter((tag) => tag !== IN_PROGRESS_TAG) : [...node.tags, IN_PROGRESS_TAG],
            now: nowIso(),
          })
        }
        className={cn(
          'rounded-md p-2 hover:bg-accent',
          TOUCH_TARGET,
          on ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Activity className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}
