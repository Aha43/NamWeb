import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { canonicalTag, featureForTag, featuresFor } from '@/domain/systemTags';
import { cn } from '@/lib/utils';

/**
 * The **Features** dialog (#1023): the friendly face of a node's system tags. One row per applicable
 * feature — a checkbox + short label on the left, a plain-language "what this does" on the right —
 * so users flip a behaviour on/off without hunting for a `#`-tag or decoding its name.
 *
 * Presentational: the host supplies the current `tags` and an `onToggle`, and decides what a toggle
 * means (the workbench header dispatches immediately; the action editor edits its unsaved buffer).
 * Which rows appear is `featuresFor(isProject, inShare)` — including the `#shared-*` grammar, which
 * only surfaces when the node is inside a share.
 */
export function NodeFeaturesDialog({
  open,
  onOpenChange,
  isProject,
  inShare,
  tags,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isProject: boolean;
  inShare: boolean;
  tags: string[];
  onToggle: (tag: string, on: boolean) => void;
}) {
  const { t } = useTranslation();
  const features = featuresFor({ isProject, inShare });
  const has = (tag: string) => tags.some((x) => canonicalTag(x) === tag);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle>{t('features.title')}</DialogTitle>
          <DialogDescription>{t('features.description')}</DialogDescription>
        </DialogHeader>

        {features.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('features.none')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {features.map((f) => {
              // A feature the share rules override when its superseding tag is also set (e.g. a hard
              // #shared-hide beats #shared-show): keep the checkbox honest but inert, and say why, so
              // "Force-shown" can't silently promise something hide is overriding (#1023 review, P2).
              const overridden = Boolean(f.supersededBy && has(f.supersededBy));
              const overrider = f.supersededBy ? featureForTag(f.supersededBy) : undefined;
              return (
                <li key={f.tag} className="grid grid-cols-[minmax(8rem,auto)_1fr] items-start gap-x-4 gap-y-1">
                  <label
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium',
                      overridden ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={has(f.tag)}
                      disabled={overridden}
                      onChange={(e) => {
                        if (!overridden) onToggle(f.tag, e.target.checked);
                      }}
                    />
                    {t(f.labelKey)}
                  </label>
                  <span className="text-sm text-muted-foreground">
                    {overridden && overrider
                      ? t('features.overriddenBy', { feature: t(overrider.labelKey) })
                      : t(f.descKey)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
