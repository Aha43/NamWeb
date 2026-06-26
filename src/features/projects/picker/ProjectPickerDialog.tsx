import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
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
import { useWorkspaceContext } from '@/store/workspace-context';
import { projectPath } from '@/domain/lenses';
import { cn } from '@/lib/utils';
import { childColumn, rootColumn, type PickerItem, type PickerTarget } from './pickerModel';

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
  onConfirm: (targetId: string) => void;
}

/**
 * A macOS Finder-style **column (Miller) view** for choosing a destination project. Desktop-primary:
 * navigate left→right, one column per level; greyed rows (not in `targets`) stay navigable so you can
 * drill past them, but can't be chosen. Click selects/opens; double-click or "Move here" confirms.
 */
export function ProjectPickerDialog({
  open,
  onOpenChange,
  title,
  confirmLabel = 'Move here',
  targets,
  initialSelectedId,
  onConfirm,
}: ProjectPickerDialogProps) {
  const { document } = useWorkspaceContext();
  const allowed = useMemo(() => new Set(targets.map((t) => t.id)), [targets]);
  // The chain of opened project ids forming columns 1..n (column 0 is always the roots).
  const [trail, setTrail] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);

  // Reset navigation each time the picker opens, so it doesn't reopen mid-tree from a prior use.
  useEffect(() => {
    if (open) {
      setTrail([]);
      setSelectedId(initialSelectedId ?? null);
    }
  }, [open, initialSelectedId]);

  if (!document) return null;

  const columns: PickerItem[][] = [rootColumn(document, targets, allowed)];
  for (const pid of trail) columns.push(childColumn(document, pid, allowed));

  const select = (level: number, item: PickerItem) => {
    setSelectedId(item.id);
    // Opening a project with sub-projects reveals the next column; anything else ends the trail here.
    if (!item.isSpecial && item.hasChildren) setTrail([...trail.slice(0, level), item.id]);
    else setTrail(trail.slice(0, level));
  };

  const canConfirm = selectedId !== null && allowed.has(selectedId);
  const confirm = () => {
    if (selectedId && allowed.has(selectedId)) {
      onConfirm(selectedId);
      onOpenChange(false);
    }
  };

  const specialLabel = targets.find((t) => t.id === selectedId && !document.nodes[t.id]?.project)?.label;
  const crumb = !selectedId
    ? null
    : specialLabel ??
      [...projectPath(document, selectedId), document.nodes[selectedId]?.title].filter(Boolean).join(' › ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Click a project to open its sub-projects; pick a destination.</DialogDescription>
        </DialogHeader>
        <DialogBody className="p-0">
          <div className="flex h-72 overflow-x-auto">
            {columns.map((items, level) => (
              <ul
                key={level} // columns are positional by depth
                aria-label={level === 0 ? 'Projects' : 'Sub-projects'}
                className="h-full w-52 shrink-0 overflow-y-auto border-r border-border py-1 last:border-r-0"
              >
                {items.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-muted-foreground">No sub-projects</li>
                ) : (
                  items.map((item) => {
                    const isOpen = trail[level] === item.id;
                    const isSelected = selectedId === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-label={item.label}
                          aria-disabled={!item.selectable}
                          aria-current={isSelected || undefined}
                          onClick={() => select(level, item)}
                          onDoubleClick={() => {
                            if (item.selectable) {
                              onConfirm(item.id);
                              onOpenChange(false);
                            }
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                            isSelected
                              ? 'bg-accent text-accent-foreground'
                              : isOpen
                                ? 'bg-accent/50'
                                : 'hover:bg-accent/40',
                            !item.selectable && 'text-muted-foreground',
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.hasChildren && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            ))}
          </div>
        </DialogBody>
        <DialogFooter className="items-center gap-2 border-t border-border px-6 py-4">
          <span className="mr-auto min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {crumb ?? 'Nothing selected'}
          </span>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canConfirm} onClick={confirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
