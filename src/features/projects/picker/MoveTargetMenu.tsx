import { type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PickerTarget } from './pickerModel';

/** Show just the leaf for a ` › `-joined path label — the proximate menu stays compact. */
function shortLabel(label: string): string {
  const parts = label.split(' › ');
  return parts[parts.length - 1] || label;
}

/**
 * The fast-move menu: a short list of **proximate** destinations (parent / siblings / Free or Top)
 * for one-click moves, plus a **"Browse all projects…"** item that opens the full column picker.
 * Restores the quick move-to-sibling/parent that the picker buried, while keeping the picker a click
 * away for anywhere else. Desktop only — callers keep the inline dropdown on phone.
 */
const ICON_TRIGGER = 'rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground';

export function MoveTargetMenu({
  quickTargets,
  onPick,
  onBrowse,
  label,
  triggerClassName = ICON_TRIGGER,
  disabled,
  children,
}: {
  /** Proximate destinations ({id,label}); labels may be ` › `-joined paths (shown by leaf). */
  quickTargets: PickerTarget[];
  onPick: (id: string) => void;
  onBrowse: () => void;
  /** Accessible label for the trigger (e.g. `Move "Buy tiles" to another project`). */
  label: string;
  /** Override the trigger styling (default: a compact icon button). */
  triggerClassName?: string;
  disabled?: boolean;
  /** The trigger content (e.g. a folder icon, or "Move to ▾"). */
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <Tooltip label={disabled ? undefined : label}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button type="button" aria-label={label} disabled={disabled} className={cn(triggerClassName)}>
            {children}
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {quickTargets.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => onPick(t.id)}>
            {shortLabel(t.label)}
          </DropdownMenuItem>
        ))}
        {quickTargets.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={onBrowse}>Browse all projects…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
