import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useSettings } from '@/components/settings/settings-context';
import { AuthUserContext } from '@/auth/auth-context';
import { ShareDialog } from './ShareDialog';

/**
 * The workbench Share entry (#759) — self-gating so hosts can mount it unconditionally:
 * renders nothing unless Labs is on (the epic ships dark until the 2.0.0 cut) and the session
 * is real (the demo has no backend to publish to).
 */
export function ShareButton({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { labs } = useSettings();
  // Optional read: presentational hosts/tests render without the auth provider → no button.
  const user = useContext(AuthUserContext);
  const [open, setOpen] = useState(false);
  if (!labs || !user || user.aud === 'demo') return null;
  return (
    <>
      <Tooltip label={t('share.buttonTooltip')}>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" aria-label={t('share.button')} onClick={() => setOpen(true)}>
          <Share2 className="h-4 w-4" />
        </Button>
      </Tooltip>
      <ShareDialog projectId={projectId} open={open} onOpenChange={setOpen} />
    </>
  );
}
