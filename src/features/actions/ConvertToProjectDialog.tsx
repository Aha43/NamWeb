import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { newId } from '@/lib/local';

/**
 * The "make this a project" moment (#999): converting an action to a project is often when the
 * sub-actions are top of mind, so let people jot their **names** right then — no tags/dates/etc.
 * Quick-add (type, Enter) builds a list; Create converts + seeds those actions. Zero names creates
 * an empty project (today's behaviour); Cancel aborts the conversion. Presentational — reports the
 * names via `onConfirm`.
 */
export function ConvertToProjectDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onConfirm: (actionNames: string[]) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [names, setNames] = useState<{ id: string; name: string }[]>([]);

  // The provider keeps this dialog mounted; reset its brain-dump each time it opens.
  useEffect(() => {
    if (open) {
      setDraft('');
      setNames([]);
    }
  }, [open]);

  const addDraft = () => {
    const name = draft.trim();
    if (!name) return;
    setNames((xs) => [...xs, { id: newId(), name }]);
    setDraft('');
  };

  const create = () => {
    const trailing = draft.trim();
    onConfirm([...names.map((n) => n.name), ...(trailing ? [trailing] : [])]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            create();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('convert.title', { title })}</DialogTitle>
          <DialogDescription>{t('convert.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Input
              aria-label={t('convert.addAria')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addDraft();
                }
              }}
              placeholder={t('convert.addPlaceholder')}
              className="min-w-0 flex-1"
            />
            <Button type="button" variant="outline" size="icon" aria-label={t('common.add')} onClick={addDraft}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {names.length > 0 && (
            <ul className="flex flex-col gap-1">
              {names.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">{n.name}</span>
                  <button
                    type="button"
                    aria-label={t('convert.removeAria', { name: n.name })}
                    onClick={() => setNames((xs) => xs.filter((x) => x.id !== n.id))}
                    className="rounded-md p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={create}>
            {t('convert.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
