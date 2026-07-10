import { useState, type FormEvent } from 'react';
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

const RESOURCE_TYPES: ResourceType[] = ['URI', 'EMAIL', 'FILE', 'TEXT'];

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

  function submit(event: FormEvent) {
    event.preventDefault();
    // Radix portals keep REACT-tree bubbling: without this, the nested form's submit reaches the
    // hosting ActionDialog's form and saves/closes the whole editor (#720).
    event.stopPropagation();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit({
      type,
      value: trimmed,
      // The name field only shows for URI, where an empty entry is a deliberate clear. For other
      // types, PRESERVE any existing description — it's a shared-contract field the desktop can
      // populate; a web-side value edit must not silently null it (#724).
      description: type === 'URI' ? (name.trim() ? name.trim() : null) : (initial?.description ?? null),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
              {RESOURCE_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </div>
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
          {type === 'URI' && (
            <div className="space-y-1.5">
              <Label htmlFor="resource-name">{t('editor.resourceName')}</Label>
              <Input
                id="resource-name"
                placeholder={t('editor.resourceNamePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              {initial ? t('common.save') : t('common.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
