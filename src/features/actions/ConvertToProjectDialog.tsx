import { useEffect, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/ui/copy-button';
import { Tooltip } from '@/components/ui/tooltip';
import { InlineRename } from './InlineRename';
import { newId } from '@/lib/local';

/**
 * The "make this a project" moment (#999): converting an action to a project is often when the
 * sub-actions are top of mind, so let people jot their **names** right then. The **project name**
 * (seeded from the action) is editable up top — often the project wants a fresh name while the
 * original action becomes one of its actions (copy helps you re-add it). Each jotted name has copy /
 * rename / remove (#1000 follow-up). Create converts + seeds the actions; empty creates an empty
 * project; Cancel aborts. Presentational — reports `(projectTitle, actionNames)` via `onConfirm`.
 */
export function ConvertToProjectDialog({
  open,
  onOpenChange,
  actionTitle,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The action being converted — seeds the project name and is offered to copy as a first action. */
  actionTitle: string;
  onConfirm: (projectTitle: string, actionNames: string[]) => void;
}) {
  const { t } = useTranslation();
  const [projectTitle, setProjectTitle] = useState(actionTitle);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState('');
  const [names, setNames] = useState<{ id: string; name: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // The provider keeps this dialog mounted; reset it each time it opens.
  useEffect(() => {
    if (open) {
      setProjectTitle(actionTitle);
      setEditingName(false);
      setDraft('');
      setNames([]);
      setEditingId(null);
    }
  }, [open, actionTitle]);

  const addDraft = () => {
    const name = draft.trim();
    if (!name) return;
    setNames((xs) => [...xs, { id: newId(), name }]);
    setDraft('');
  };

  const create = () => {
    const trailing = draft.trim();
    onConfirm(projectTitle.trim() || actionTitle, [...names.map((n) => n.name), ...(trailing ? [trailing] : [])]);
  };

  const iconBtn = 'rounded-md p-1 text-muted-foreground hover:text-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={(e) => {
          // Don't create from ⌘/Ctrl+Enter while an inline rename is active: the InlineRename commits
          // during the same bubbling keydown, so create() would still read the pre-commit project/
          // action name and silently drop the edit (#1000 review, P1). Let the rename commit; the next
          // ⌘/Ctrl+Enter creates. (Normal button/click commits via blur first, so it's unaffected.)
          if (editingName || editingId !== null) return;
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            create();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('convert.title')}</DialogTitle>
          <DialogDescription>{t('convert.description')}</DialogDescription>
        </DialogHeader>

        {/* Project name — seeded from the action, editable (the project often wants a fresh name);
            copy grabs it so the original action can be re-added as one of the project's actions. */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{t('convert.projectName')}</span>
          {editingName ? (
            <InlineRename
              title={projectTitle}
              onCommit={(v) => {
                setProjectTitle(v);
                setEditingName(false);
              }}
              onCancel={() => setEditingName(false)}
            />
          ) : (
            <div className="flex items-center gap-1 rounded-md border border-border bg-card/60 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{projectTitle}</span>
              <Tooltip label={t('common.rename')}>
                <button type="button" aria-label={t('convert.renameProjectAria')} onClick={() => setEditingName(true)} className={iconBtn}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
              <CopyButton value={projectTitle} label={t('copy.name', { title: projectTitle })} tooltip />
            </div>
          )}
        </div>

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
              {names.map((n) =>
                editingId === n.id ? (
                  <li key={n.id}>
                    <InlineRename
                      title={n.name}
                      onCommit={(v) => {
                        setNames((xs) => xs.map((x) => (x.id === n.id ? { ...x, name: v } : x)));
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <li
                    key={n.id}
                    className="flex items-center gap-1 rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">{n.name}</span>
                    <Tooltip label={t('common.rename')}>
                      <button type="button" aria-label={t('convert.renameAria', { name: n.name })} onClick={() => setEditingId(n.id)} className={iconBtn}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                    <CopyButton value={n.name} label={t('copy.name', { title: n.name })} tooltip />
                    <button
                      type="button"
                      aria-label={t('convert.removeAria', { name: n.name })}
                      onClick={() => setNames((xs) => xs.filter((x) => x.id !== n.id))}
                      className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ),
              )}
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
