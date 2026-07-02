import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerPopover } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TagsInput } from '../actions/TagsInput';
import { InheritedTags } from '../actions/InheritedTags';
import { ResourcesEditor } from '../actions/ResourcesEditor';
import { CopyButton } from '@/components/ui/copy-button';
import { Tooltip } from '@/components/ui/tooltip';
import type { ActionEdits } from '../actions/ActionDialog';
import { cn } from '@/lib/utils';
import { parseFlexibleDate } from '@/lib/dates';
import type { NamNode, NodeStatus, Resource } from '@/domain/types';

const STATUSES: { value: NodeStatus; label: string }[] = [
  { value: 'NEXT', label: 'domain.status.next' },
  { value: 'BACKLOG', label: 'domain.status.backlog' },
  { value: 'DONE', label: 'domain.status.done' },
];

/**
 * Edit the current project's title, notes, tags, due date, status, and resources inline on its
 * workbench — the project's home surface — instead of in the overloaded action dialog. Collapsible
 * (controlled by the page, which persists the state and can force it open via an "edit details"
 * action). Seeded from `project`; **autosaves** — text fields commit on blur, discrete controls
 * (status, tags, resources) on change — via `onSave`, which the page diffs into granular intents.
 * Never mutates.
 */
export function ProjectDetailsPanel({
  project,
  collapsed,
  onToggle,
  onSave,
  availableTags = [],
  inheritedTags = [],
  onDelete,
}: {
  project: NamNode;
  collapsed: boolean;
  onToggle: () => void;
  onSave: (edits: ActionEdits) => void;
  availableTags?: string[];
  /** Tags inherited from ancestor projects ("rub-off") — shown read-only. */
  inheritedTags?: string[];
  /** Delete the project — opens the advanced-delete dialog (content disposition + undo). */
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? '');
  const [tags, setTags] = useState(project.tags.join(', '));
  const [due, setDue] = useState(project.dueAt ?? '');
  const [dueError, setDueError] = useState(false);
  const [status, setStatus] = useState<NodeStatus>(project.status);
  const [resources, setResources] = useState<Resource[]>(project.resources);
  const [saved, setSaved] = useState(false);

  // Build the edits snapshot from current state (with optional overrides for a just-changed discrete
  // control, to dodge setState's async staleness) and report it. Never persists an empty title or an
  // unparseable due — those fall back to the project's current value, so one bad field can't block
  // saving the others. The page diffs this snapshot into per-field intents (one small synced write).
  const commit = (override: Partial<{
    title: string;
    description: string;
    tags: string;
    due: string;
    status: NodeStatus;
    resources: Resource[];
  }> = {}) => {
    const rawTitle = (override.title ?? title).trim();
    const rawDue = override.due ?? due;
    const parsedDue = parseFlexibleDate(rawDue);
    const trimmedDescription = (override.description ?? description).trim();
    onSave({
      title: rawTitle || project.title,
      description: trimmedDescription ? trimmedDescription : null,
      tags: (override.tags ?? tags).split(',').map((tag) => tag.trim()).filter(Boolean),
      dueAt: rawDue.trim() === '' ? null : (parsedDue ?? project.dueAt),
      status: override.status ?? status,
      resources: override.resources ?? resources,
    });
    setSaved(true);
  };

  // Text fields commit when focus leaves them.
  const commitTitle = () => {
    if (!title.trim()) {
      setTitle(project.title); // never leave an empty title in the box
      return;
    }
    commit();
  };
  const commitDue = () => {
    if (due.trim() === '') {
      commit({ due: '' });
      return;
    }
    const iso = parseFlexibleDate(due);
    if (iso === null) {
      setDueError(true); // flag it, keep the persisted due
      return;
    }
    setDue(iso); // normalize the entry to ISO
    commit({ due: iso });
  };

  return (
    <div className="rounded-lg border border-border">
      <Tooltip label={collapsed ? t('details.expandTooltip') : t('details.collapseTooltip')}>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={onToggle}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          <span>{t('details.details')}</span>
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </Tooltip>
      {!collapsed && (
        <div className="space-y-4 border-t border-border p-3">
          {/* Title on one line — label + field + copy (far right) — to save vertical space (#558). */}
          <div className="flex items-center gap-2">
            <Label htmlFor="project-title" className="shrink-0">{t('editor.fieldTitle')}</Label>
            <Input
              id="project-title"
              className="min-w-0 flex-1"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved(false);
              }}
              onBlur={commitTitle}
            />
            <CopyButton value={title} label={t('copy.title')} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="project-description">{t('editor.fieldDescription')}</Label>
              <CopyButton value={description} label={t('copy.description')} />
            </div>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setSaved(false);
              }}
              onBlur={() => commit()}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Tags commit when focus leaves the field — its onChange fires per keystroke. */}
            <div className="space-y-1.5" onBlur={() => commit()}>
              <Label htmlFor="project-tags">{t('editor.fieldTags')}</Label>
              <TagsInput
                id="project-tags"
                value={tags}
                onChange={(v) => {
                  setTags(v);
                  setSaved(false);
                }}
                suggestions={availableTags}
              />
              <InheritedTags tags={inheritedTags} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-due">{t('editor.fieldDue')}</Label>
              <div className="flex gap-1.5">
                <Input
                  id="project-due"
                  className="min-w-0 flex-1"
                  placeholder={t('editor.duePlaceholder')}
                  value={due}
                  aria-invalid={dueError}
                  onChange={(e) => {
                    setDue(e.target.value);
                    setSaved(false);
                    if (dueError) setDueError(false);
                  }}
                  onBlur={commitDue}
                />
                <DatePickerPopover
                  value={parseFlexibleDate(due)}
                  onSelect={(isoDate) => { setDue(isoDate); setDueError(false); commit({ due: isoDate }); }}
                  label={t('editor.pickDueDate')}
                />
              </div>
              {dueError && (
                <p role="alert" className="text-xs text-destructive">
                  {t('editor.dueError')}
                </p>
              )}
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">{t('editor.statusLegend')}</legend>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <label
                  key={s.value}
                  className={cn(
                    'cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    status === s.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <input
                    type="radio"
                    name="project-status"
                    className="sr-only"
                    checked={status === s.value}
                    onChange={() => {
                      setStatus(s.value);
                      commit({ status: s.value });
                    }}
                  />
                  {t(s.label)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5 border-t border-border pt-3">
            <span className="text-sm font-medium text-foreground">{t('editor.resources')}</span>
            <ResourcesEditor
              resources={resources}
              onChange={(r) => {
                setResources(r);
                commit({ resources: r });
              }}
            />
          </div>
          {(onDelete || saved) && (
            <div className="flex items-center gap-3 border-t border-border pt-3">
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onDelete}
                  className="mr-auto text-destructive hover:text-destructive"
                >
                  {t('delete.deleteProject')}
                </Button>
              )}
              {saved && (
                <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
                  {t('details.saved')}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
