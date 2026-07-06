import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useSettings } from '@/components/settings/settings-context';
import { allOpenableActions, allOpenableProjects } from '@/domain/lenses';
import { ProjectPickerDialog } from './ProjectPickerDialog';
import { ActionEditorContext } from '@/features/actions/action-editor-context';

/**
 * The **explorer** (#595, both-mode since #657): a toolbar button opening the Finder-style column
 * browser from the top — projects as folders, actions as files. Opening a project navigates to its
 * workbench; opening an action opens its editor. Independent of bookmarks (the bookmark rows' "…"
 * opens the same picker pre-navigated to a hub).
 */
export function ProjectExplorerButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Optional: the provider wraps the whole app; presentational test hosts may render bare.
  const editor = useContext(ActionEditorContext);
  const { document } = useWorkspaceContext();
  const { dense } = useSettings();
  const [open, setOpen] = useState(false);
  if (!document) return null;
  return (
    <>
      <Tooltip label={dense ? t('nav.projectExplorer') : t('nav.projectExplorerHint')}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          aria-label={t('nav.projectExplorer')}
          onClick={() => setOpen(true)}
        >
          <FolderTree className="h-4 w-4" />
          {!dense && <span className="hidden lg:inline">{t('nav.projectExplorer')}</span>}
        </Button>
      </Tooltip>
      <ProjectPickerDialog
        open={open}
        onOpenChange={setOpen}
        title={t('picker.openAnyTitle')}
        confirmLabel={t('picker.open')}
        targets={[...allOpenableProjects(document), ...allOpenableActions(document)]}
        mode="both"
        onConfirm={(id) => {
          // Folders open their workbench; files open their editor (#657).
          if (document.nodes[id]?.project) navigate(`/projects/${id}`);
          else editor?.openEditor(id);
        }}
      />
    </>
  );
}
