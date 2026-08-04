import { useContext, useMemo, useState } from 'react';
import { Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { WorkspaceContext } from '@/store/workspace-context';
import { useSharedProjectIds } from '@/features/sharing/useSharedProjectIds';
import { buildPath } from '@/domain/lenses';
import { canonicalTag } from '@/domain/systemTags';
import { nowIso } from '@/lib/local';
import { NodeFeaturesDialog } from './NodeFeaturesDialog';

/**
 * Context-aware **Features** entry for the project workbench header (#1023): opens the Features
 * dialog for a node and dispatches tag changes straight to the workspace (no edit buffer here,
 * unlike the action editor). Self-contained — reads the live node/tags and computes whether it's
 * inside a share to gate the `#shared-*` rows. Renders nothing without a workspace (presentational
 * hosts/tests). Works in the demo (it reads the local doc) — only the `#shared-*` rows stay hidden
 * there, since the demo has no shares.
 */
export function NodeFeaturesButton({ nodeId, dense = false }: { nodeId: string; dense?: boolean }) {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  const sharedIds = useSharedProjectIds();
  const [open, setOpen] = useState(false);
  const doc = workspace?.document ?? null;
  const inShare = useMemo(() => {
    if (!doc || !sharedIds) return false;
    const ids = [nodeId, ...buildPath(doc, nodeId).map((n) => n.id)];
    return ids.some((id) => sharedIds.has(id));
  }, [doc, sharedIds, nodeId]);

  const node = doc?.nodes[nodeId];
  if (!workspace || !node) return null;

  const toggle = (tag: string, on: boolean) => {
    workspace.dispatch({
      type: 'updateTags',
      id: nodeId,
      tags: on ? [...node.tags, tag] : node.tags.filter((x) => canonicalTag(x) !== tag),
      now: nowIso(),
    });
  };

  return (
    <>
      <Tooltip label={t('features.tooltip')}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          aria-label={t('features.button')}
          onClick={() => setOpen(true)}
        >
          <Flag className="h-4 w-4" />
          {!dense && t('features.button')}
        </Button>
      </Tooltip>
      <NodeFeaturesDialog
        open={open}
        onOpenChange={setOpen}
        isProject={node.project}
        inShare={inShare}
        tags={node.tags}
        onToggle={toggle}
      />
    </>
  );
}
