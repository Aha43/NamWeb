import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProjectPickerColumns } from './ProjectPickerColumns';
import type { PickerMode, PickerTarget } from './pickerModel';

export interface ProjectPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog heading, e.g. `Move "Buy tiles" to…`. */
  title: string;
  /** Confirm-button label. */
  confirmLabel?: string;
  /** The valid destinations the caller already computes ({id,label}); defines what's selectable. */
  targets: PickerTarget[];
  /** Optionally pre-highlight a destination (e.g. the current parent). */
  initialSelectedId?: string;
  /** Open with the columns already navigated to this project (ancestors opened, it selected) —
   *  browsing *from* a starting point, e.g. a bookmarked hub (#595). Overrides initialSelectedId. */
  initialProjectId?: string;
  onConfirm: (targetId: string) => void;
  /**
   * When provided, enables "New project here": create a sub-project under the current location
   * (the navigated-into project, or `null` = top level) and move into it. Returns the new id.
   */
  onCreateProject?: (parentId: string | null, title: string) => string;
  /** What the browser lists (#657): folders only (default), or actions as leaves too. */
  mode?: PickerMode;
}

/**
 * The modal shell around {@link ProjectPickerColumns} (a macOS Finder-style column view for
 * choosing a destination project): header, Cancel, and a confirm button. Definitive picks inside
 * the columns (double-click, ⌘/Ctrl+Enter, "New project here") confirm-and-close directly.
 */
export function ProjectPickerDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  targets,
  initialSelectedId,
  initialProjectId,
  onConfirm,
  onCreateProject,
  mode,
}: ProjectPickerDialogProps) {
  const { t } = useTranslation();
  // The columns' current confirmable destination (null = nothing selectable highlighted).
  const [confirmable, setConfirmable] = useState<string | null>(null);

  const pick = (id: string) => {
    onConfirm(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('picker.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="p-0">
          <ProjectPickerColumns
            targets={targets}
            initialSelectedId={initialSelectedId}
            initialProjectId={initialProjectId}
            onSelectionChange={setConfirmable}
            onPick={pick}
            onCreateProject={onCreateProject}
            mode={mode}
          />
        </DialogBody>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={confirmable === null} onClick={() => confirmable && pick(confirmable)}>
            {confirmLabel ?? t('picker.moveHere')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
