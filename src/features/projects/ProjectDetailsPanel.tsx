import { useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TagsInput } from '../actions/TagsInput';
import { InheritedTags } from '../actions/InheritedTags';
import { ResourcesEditor } from '../actions/ResourcesEditor';
import type { ActionEdits } from '../actions/ActionDialog';
import { cn } from '@/lib/utils';
import { parseFlexibleDate } from '@/lib/dates';
import type { NamNode, NodeStatus, Resource } from '@/domain/types';

const STATUSES: { value: NodeStatus; label: string }[] = [
  { value: 'NEXT', label: 'Next' },
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'DONE', label: 'Done' },
];

/**
 * Edit the current project's title, notes, tags, due date, status, and resources inline on its
 * workbench — the project's home surface — instead of in the overloaded action dialog. Collapsible
 * (controlled by the page, which persists the state and can force it open via an "edit details"
 * action). Seeded from `project`; reports the edited fields on Save and never mutates.
 */
export function ProjectDetailsPanel({
  project,
  collapsed,
  onToggle,
  onSave,
  availableTags = [],
  inheritedTags = [],
  onDelete,
  deleteConfirmMessage,
}: {
  project: NamNode;
  collapsed: boolean;
  onToggle: () => void;
  onSave: (edits: ActionEdits) => void;
  availableTags?: string[];
  /** Tags inherited from ancestor projects ("rub-off") — shown read-only. */
  inheritedTags?: string[];
  /** Delete the project (recursive); the panel confirms inline. */
  onDelete?: () => void;
  /** Count-aware confirm message shown in the inline delete confirm. */
  deleteConfirmMessage?: string;
}) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? '');
  const [tags, setTags] = useState(project.tags.join(', '));
  const [due, setDue] = useState(project.dueAt ?? '');
  const [dueError, setDueError] = useState(false);
  const [status, setStatus] = useState<NodeStatus>(project.status);
  const [resources, setResources] = useState<Resource[]>(project.resources);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const dueAt = parseFlexibleDate(due);
    if (due.trim() && dueAt === null) {
      setDueError(true);
      return;
    }
    const trimmedDescription = description.trim();
    onSave({
      title: trimmedTitle,
      description: trimmedDescription ? trimmedDescription : null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      dueAt,
      status,
      resources,
    });
    setSaved(true);
  }

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
      >
        <span>Details</span>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {!collapsed && (
        <form onSubmit={submit} className="space-y-4 border-t border-border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="project-title">Title</Label>
            <Input
              id="project-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="project-tags">Tags</Label>
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
              <Label htmlFor="project-due">Due</Label>
              <Input
                id="project-due"
                placeholder="26-7-4"
                value={due}
                aria-invalid={dueError}
                onChange={(e) => {
                  setDue(e.target.value);
                  setSaved(false);
                  if (dueError) setDueError(false);
                }}
                onBlur={() => {
                  const iso = parseFlexibleDate(due);
                  if (iso) setDue(iso);
                }}
              />
              {dueError && (
                <p role="alert" className="text-xs text-destructive">
                  Use a date like 26-7-4 or 2026-07-04.
                </p>
              )}
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">Status</legend>
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
                      setSaved(false);
                    }}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5 border-t border-border pt-3">
            <span className="text-sm font-medium text-foreground">Resources</span>
            <ResourcesEditor
              resources={resources}
              onChange={(r) => {
                setResources(r);
                setSaved(false);
              }}
            />
          </div>
          {confirmingDelete ? (
            <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
              <span className="text-sm text-destructive sm:mr-auto">
                {deleteConfirmMessage ?? 'Delete this project? This cannot be undone.'}
              </span>
              <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={() => onDelete?.()}>
                Delete
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 border-t border-border pt-3">
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(true)}
                  className="mr-auto text-destructive hover:text-destructive"
                >
                  Delete project
                </Button>
              )}
              {saved && <span className="ml-auto text-xs text-muted-foreground">Saved</span>}
              <Button type="submit">Save</Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
