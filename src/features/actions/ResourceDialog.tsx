import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Resource, ResourceType } from '@/domain/types';
import { RESOURCE_TYPE_DEFS, RESOURCE_TYPES_ORDERED } from './resourceTypes';
import { newCountValue, parseCount, formatCount } from '@/domain/resourceCount';
import { newQuestionValue } from '@/domain/resourceQuestion';

/**
 * Create / edit one resource in a small dialog (#720) — rows stay pure display; this is where the
 * form fields went. `initial` prefills for an edit (null = create, URI preselected). The name
 * field shows for URI resources only — it lands in `Resource.description` (#715), never in the
 * value, which stays the pure URI the desktop and the copy button read.
 */
export function ResourceDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The resource being edited, or null to create a new one. */
  initial: Resource | null;
  onSubmit: (resource: Resource) => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<ResourceType>(initial?.type ?? 'URI');
  const [value, setValue] = useState(initial?.value ?? '');
  const [name, setName] = useState(initial?.description ?? '');
  // COUNT (#798): the dialog asks for the target; the packed "current/target" value is derived.
  const initialCount = initial?.type === 'COUNT' ? parseCount(initial.value) : null;
  const [countTarget, setCountTarget] = useState(initialCount ? String(initialCount.target) : '');
  const [resetCount, setResetCount] = useState(false);
  const [unlimited, setUnlimited] = useState(initialCount?.unlimited ?? false);
  const [guestEditable, setGuestEditable] = useState(initial?.guestEditable ?? false);
  const [completesAction, setCompletesAction] = useState(initial?.completesAction ?? false);
  // #802/F2: un-ticking "goal, not a cap" on an overshot counter clamps real recorded stock
  // (14/12 -> 12/12) — that's data destruction, so it gets a visible tell before Save. The
  // sibling clamp (shrinking the target below current) shows the same line: same loss.
  const parsedTarget = Number(countTarget);
  const clampWarning =
    initialCount && !unlimited && !resetCount && Number.isInteger(parsedTarget) && parsedTarget >= 1 && initialCount.current > parsedTarget
      ? { current: initialCount.current, target: parsedTarget }
      : null;
  const def = RESOURCE_TYPE_DEFS[type];
  // #832/P3: switching the type TO question mid-dialog only flips the input's autoFocus prop,
  // which React does not re-run on an already-mounted element — focus it explicitly.
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (def.valueKind === 'question') nameRef.current?.focus();
  }, [def.valueKind]);

  // The commit shared by the form submit and ⌘/Ctrl+Enter (#746). Guards intact: empty refuses.
  function commit() {
    let committedValue: string;
    if (def.valueKind === 'countTarget') {
      const target = Number(countTarget);
      if (!Number.isInteger(target) || target < 1) return;
      // Editing keeps progress (clamped to a shrunken cap) unless a reset is asked for.
      const current = resetCount ? 0 : (initialCount?.current ?? 0);
      committedValue = resetCount ? newCountValue(target, unlimited) : formatCount(current, target, unlimited);
    } else if (def.valueKind === 'question') {
      if (!name.trim()) return; // the question text is required
      committedValue = initial?.type === 'QUESTION' ? initial.value : newQuestionValue();
    } else {
      const trimmed = value.trim();
      if (!trimmed) return;
      committedValue = trimmed;
    }
    onSubmit({
      type,
      value: committedValue,
      // Additive, absent-means-off (#809): never write false into the document.
      ...(RESOURCE_TYPE_DEFS[type].interactive && guestEditable ? { guestEditable: true } : {}),
      ...(def.valueKind === 'countTarget' && completesAction ? { completesAction: true } : {}),
      // The name field shows only where the def says so; an empty entry there is a deliberate
      // clear. Elsewhere PRESERVE any existing description — it's a shared-contract field a
      // desktop-era document can carry; a web-side value edit must not silently null it (#724).
      description: def.hasNameField ? (name.trim() ? name.trim() : null) : (initial?.description ?? null),
    });
    onOpenChange(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Radix portals keep REACT-tree bubbling: without this, the nested form's submit reaches the
    // hosting ActionDialog's form and saves/closes the whole editor (#720).
    event.stopPropagation();
    commit();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        // ⌘/Ctrl+Enter = the app-wide "commit this dialog" gesture (#746). stopPropagation: the
        // hosting editor listens on the document and must not also see it.
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.stopPropagation();
            commit();
          }
        }}
      >
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader className="text-left">
            <DialogTitle>{initial ? t('editor.editResourceTitle') : t('editor.addResourceTitle')}</DialogTitle>
            <DialogDescription>{t('editor.resourceDialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="resource-type">{t('editor.resourceType')}</Label>
            <select
              id="resource-type"
              value={type}
              onChange={(e) => setType(e.target.value as ResourceType)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
            >
              {RESOURCE_TYPES_ORDERED.map((rt) => (
                <option key={rt} value={rt}>
                  {t(RESOURCE_TYPE_DEFS[rt].labelKey)}
                </option>
              ))}
            </select>
          </div>
          {def.valueKind === 'countTarget' ? (
            <div className="space-y-1.5">
              <Label htmlFor="resource-count-target">{t('editor.resourceCountTarget')}</Label>
              <Input
                id="resource-count-target"
                autoFocus
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="10"
                value={countTarget}
                onChange={(e) => setCountTarget(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
                {t('editor.resourceCountUnlimited')}
              </label>
              {clampWarning !== null && (
                <p role="alert" className="text-xs text-amber-600 dark:text-amber-500">
                  {t('editor.resourceCountClampWarning', { current: clampWarning.current, target: clampWarning.target })}
                </p>
              )}
              {initialCount && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={resetCount} onChange={(e) => setResetCount(e.target.checked)} />
                  {t('editor.resourceCountReset', { current: initialCount.current })}
                </label>
              )}
            </div>
          ) : def.valueKind === 'question' ? null : (
            <div className="space-y-1.5">
              <Label htmlFor="resource-value">{t('editor.resourceValue')}</Label>
              <Input
                id="resource-value"
                autoFocus
                placeholder={t('editor.resourcePlaceholder')}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          )}
          {def.interactive && (
            <>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={guestEditable} onChange={(e) => setGuestEditable(e.target.checked)} />
                {t('editor.resourceGuestEditable')}
              </label>
              {def.valueKind === 'countTarget' && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={completesAction} onChange={(e) => setCompletesAction(e.target.checked)} />
                  {t('editor.resourceCompletesAction')}
                </label>
              )}
            </>
          )}
          {def.hasNameField && (
            <div className="space-y-1.5">
              <Label htmlFor="resource-name">{t(def.nameLabelKey ?? 'editor.resourceName')}</Label>
              <Input
                id="resource-name"
                ref={nameRef}
                autoFocus={def.valueKind === 'question'}
                placeholder={def.valueKind === 'question' ? t('editor.resourceQuestionPlaceholder') : t('editor.resourceNamePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={def.valueKind === 'countTarget' ? !(Number.isInteger(Number(countTarget)) && Number(countTarget) >= 1) : def.valueKind === 'question' ? !name.trim() : !value.trim()}
            >
              {initial ? t('common.save') : t('common.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
