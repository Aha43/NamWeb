import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
function tooltipFor(target: QuickMoveTarget, t: TFunction): string {
  const name = shortLabel(target.label);
  if (target.kind === 'parent') return t('picker.moveToParent', { name });
  if (target.kind === 'subproject') return t('picker.moveToSub', { name });
  if (target.kind === 'sibling') return t('picker.moveToSibling', { name });
  return t('picker.moveToName', { name }); // free / top level — self-explanatory by name
}

const ICON_TRIGGER = 'rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground';

/**
 * The fast-move menu: proximate destinations under quiet **section headers** — Parent, Sibling,
 * Sub-project, Top level · Free actions (#1009) — so the "seemingly random projects" read as
 * categories at a glance. Each item also keeps a tooltip naming its type. A final **"Browse all
 * projects…"** opens the full column picker. Desktop only; callers keep the inline dropdown on phone.
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
  const { t } = useTranslation();
  // Labeled sections — nearest relations first (parent, sibling, deeper), then the root escapes.
  const sections = [
    { label: t('picker.sectionParent'), items: quickTargets.filter((x) => x.kind === 'parent') },
    { label: t('picker.sectionSibling'), items: quickTargets.filter((x) => x.kind === 'sibling') },
    { label: t('picker.sectionSubproject'), items: quickTargets.filter((x) => x.kind === 'subproject') },
    { label: t('picker.sectionTopLevel'), items: quickTargets.filter((x) => x.kind === 'free' || x.kind === 'toplevel') },
  ].filter((s) => s.items.length > 0);

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
        {sections.map((section, si) => (
          <Fragment key={section.label}>
            {si > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
            {section.items.map((target) => (
              <Tooltip key={target.id} label={tooltipFor(target, t)} side="right">
                <DropdownMenuItem onSelect={() => onPick(target.id)}>{shortLabel(target.label)}</DropdownMenuItem>
              </Tooltip>
            ))}
          </Fragment>
        ))}
        {sections.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={onBrowse}>{t('picker.browseAll')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
