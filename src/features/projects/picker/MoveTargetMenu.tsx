import { Fragment, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { QuickMoveTarget } from '@/domain/lenses';

/** Show just the leaf for a ` › `-joined path label — the proximate menu stays compact. */
function shortLabel(label: string): string {
  const parts = label.split(' › ');
  return parts[parts.length - 1] || label;
}

/** Tooltip text that names the destination and its neighbour type (parent / sub-project / sibling). */
function tooltipFor(t: QuickMoveTarget): string {
  const name = shortLabel(t.label);
  if (t.kind === 'parent') return `Move to ${name} (parent)`;
  if (t.kind === 'subproject') return `Move to ${name} (sub-project)`;
  if (t.kind === 'sibling') return `Move to ${name} (sibling)`;
  return `Move to ${name}`; // free / top level — self-explanatory by name
}

const ICON_TRIGGER = 'rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground';

/**
 * The fast-move menu: proximate destinations grouped by direction — **up** (parent / Free / Top
 * level) first, then **down** (the project's own sub-projects), then **sideways** (siblings) — each
 * with a tooltip naming its type, so the kinds stay learnable without cluttering the labels. A final
 * **"Browse all projects…"** opens the full column picker. Desktop only; callers keep the inline
 * dropdown on phone.
 */
export function MoveTargetMenu({
  quickTargets,
  onPick,
  onBrowse,
  label,
  triggerClassName = ICON_TRIGGER,
  disabled,
  children,
}: {
  /** Proximate destinations tagged by neighbour kind. */
  quickTargets: QuickMoveTarget[];
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
  // Up (parent / Free / Top level), then down (sub-projects), then sideways (siblings).
  const up = quickTargets.filter((t) => t.kind === 'parent' || t.kind === 'free' || t.kind === 'toplevel');
  const down = quickTargets.filter((t) => t.kind === 'subproject');
  const side = quickTargets.filter((t) => t.kind === 'sibling');
  const groups = [up, down, side].filter((g) => g.length > 0);

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
        {groups.map((group, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            {group.map((t) => (
              <Tooltip key={t.id} label={tooltipFor(t)} side="right">
                <DropdownMenuItem onSelect={() => onPick(t.id)}>{shortLabel(t.label)}</DropdownMenuItem>
              </Tooltip>
            ))}
          </Fragment>
        ))}
        {groups.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={onBrowse}>Browse all projects…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
