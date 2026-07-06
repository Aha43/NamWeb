import { useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast/toast-context';
import { makeActionLink, parseActionLink } from '@/domain/actionLinks';
import { allOpenableActions } from '@/domain/lenses';
import { nowIso } from '@/lib/local';
import { WorkspaceContext } from '@/store/workspace-context';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';

/**
 * "Link to here" (#659): with this card open, pick *another* action and a link to this card is
 * created **on the picked action** — committed immediately (the picked card isn't buffered
 * anywhere). The confirmation toast offers "Link back", which hands the reverse link to the
 * hosting dialog via `onLinkBack` (this card IS buffered — the dialog owns its resources until
 * Save). Renders nothing without a workspace provider.
 */
export function LinkToHereButton({
  nodeId,
  onLinkBack,
}: {
  nodeId: string;
  /** Add the reverse link (to `pickedId`) into the hosting editor's buffered resources. */
  onLinkBack?: (pickedId: string) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const workspace = useContext(WorkspaceContext);
  const [open, setOpen] = useState(false);
  const doc = workspace?.document;
  // Fire-time state for the toast action (#665): the doc captured at pick time can be 6s stale.
  const docRef = useRef(doc);
  docRef.current = doc;
  if (!workspace || !doc || !doc.nodes[nodeId]) return null;

  function confirm(pickedId: string) {
    const picked = doc!.nodes[pickedId];
    if (!picked) return;
    // Already links here → don't stack a duplicate; the offer still applies.
    if (!picked.resources.some((r) => parseActionLink(r) === nodeId)) {
      workspace!.dispatch({
        type: 'updateResources',
        id: pickedId,
        resources: [...picked.resources, makeActionLink(nodeId)],
        now: nowIso(),
      });
    }
    toast({
      message: t('editor.linkHereDone', { title: picked.title }),
      actionLabel: t('editor.linkBack'),
      // Re-check the picked node at fire time — if it vanished during the toast window, a
      // buffered reverse link would be broken-on-arrival and persisted by Save (#665).
      onAction: () => {
        if (docRef.current?.nodes[pickedId]) onLinkBack?.(pickedId);
      },
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Link2 className="h-3.5 w-3.5" />
        {t('editor.linkHere')}
      </Button>
      <ProjectPickerDialog
        open={open}
        onOpenChange={setOpen}
        title={t('editor.linkHereTitle')}
        confirmLabel={t('editor.linkPick')}
        targets={allOpenableActions(doc).filter((a) => a.id !== nodeId)}
        mode="actions"
        onConfirm={confirm}
      />
    </>
  );
}
