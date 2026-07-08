import { useState } from 'react';
import { FolderInput } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { useIsDesktop } from '@/shell/useIsDesktop';
import { MoveTargetMenu } from './MoveTargetMenu';
import { ProjectPickerDialog } from './ProjectPickerDialog';
import type { PickerTarget } from './pickerModel';
import type { QuickMoveTarget } from '@/domain/lenses';

/**
 * A self-contained row control that moves an action into another project: the folder icon opening
 * the proximate-destinations menu (desktop, with a "Browse all projects…" Finder picker) or an
 * inline dropdown of all destinations (phone). Mirrors the project workbench's per-row move
 * control so list views (Next, Backlog) offer the same affordance.
 */
export function MoveActionMenu({
  title,
  quickTargets,
  browseTargets,
  onMove,
  onCreateProject,
}: {
  /** The action's title — used for the accessible label and picker heading. */
  title: string;
  /** Proximate destinations tagged by neighbour kind (see `actionMoveTargets`). */
  quickTargets: QuickMoveTarget[];
  /** Full destination set for "Browse all projects…" — lazy, computed when the picker opens. */
  browseTargets: () => PickerTarget[];
  onMove: (targetId: string) => void;
  /** Create a project inside the browse picker ("New project here"). */
  onCreateProject?: (parentId: string | null, title: string) => string;
}) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const [browseOpen, setBrowseOpen] = useState(false);
  // Desktop always has "Browse all projects…" (+ New project here) to offer, even with no quick
  // targets; the phone dropdown lists only the quick set, so it hides when that's empty (#694).
  if (quickTargets.length === 0 && !isDesktop) return null;

  return (
    <>
      {isDesktop ? (
        <MoveTargetMenu
          label={t('workbench.moveActionAria', { title })}
          quickTargets={quickTargets}
          onPick={onMove}
          onBrowse={() => setBrowseOpen(true)}
        >
          <FolderInput className="h-3.5 w-3.5" />
        </MoveTargetMenu>
      ) : (
        <DropdownMenu>
          <Tooltip label={t('workbench.moveToTooltip')}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t('workbench.moveActionAria', { title })}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <FolderInput className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
            {quickTargets.map((target) => (
              <DropdownMenuItem key={target.id} onSelect={() => onMove(target.id)}>
                {target.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {browseOpen && (
        <ProjectPickerDialog
          open
          onOpenChange={(o) => {
            if (!o) setBrowseOpen(false);
          }}
          title={t('editor.moveTitle', { title })}
          targets={browseTargets()}
          onConfirm={(id) => {
            onMove(id);
            setBrowseOpen(false);
          }}
          onCreateProject={onCreateProject}
        />
      )}
    </>
  );
}
