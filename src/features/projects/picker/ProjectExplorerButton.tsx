import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useWorkspaceContext } from '@/store/workspace-context';
import { allOpenableProjects } from '@/domain/lenses';
import { ProjectPickerDialog } from './ProjectPickerDialog';

/**
 * The **project explorer** (#595): a toolbar button opening the Finder-style column picker in
 * open mode from the top — browse the whole project tree and Open one. Independent of bookmarks
 * (the bookmark rows' "…" opens the same picker pre-navigated to a hub).
 */
export function ProjectExplorerButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { document } = useWorkspaceContext();
  const [open, setOpen] = useState(false);
  if (!document) return null;
  return (
    <>
      <Tooltip label={t('nav.projectExplorerHint')}>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <FolderTree className="h-4 w-4" />
          {t('nav.projectExplorer')}
        </Button>
      </Tooltip>
      <ProjectPickerDialog
        open={open}
        onOpenChange={setOpen}
        title={t('picker.openTitle')}
        confirmLabel={t('picker.open')}
        targets={allOpenableProjects(document)}
        onConfirm={(id) => navigate(`/projects/${id}`)}
      />
    </>
  );
}
