import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Tooltip } from '@/components/ui/tooltip';
import type { Resource } from '@/domain/types';
import { makeActionLink, parseActionLink } from '@/domain/actionLinks';
import { formatCount, parseCount } from '@/domain/resourceCount';
import { allOpenableActions, projectPath } from '@/domain/lenses';
import { WorkspaceContext } from '@/store/workspace-context';
import { ActionEditorContext } from './action-editor-context';
import { ResourceDialog } from './ResourceDialog';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';

/** Attached resources (links/files/notes) as pure display rows (#720): the resource doing its job
 *  (a named link linking, a note reading) with a "…" on the left opening the type-appropriate
 *  dialog — create and edit both happen in dialogs, not inline forms. FILE is link/metadata only
 *  (no upload). Local edits are reported via onChange and committed by the surrounding editor
 *  (the action dialog, or the project workbench Details panel).
 *
 *  Action links (#658) are URI resources with the nam:// scheme: the row shows the target's live
 *  breadcrumb path (click opens its editor), "…" re-picks the target, ✕ unlinks. Both contexts are
 *  optional — without a workspace provider (presentational tests) links render as raw URIs. */
export function ResourcesEditor({
  resources,
  onChange,
  linkExcludeId,
  onFollowLink,
  onNestedOpenChange,
}: {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
  /** The hosting node — excluded from the link picker so a card can't link to itself. */
  linkExcludeId?: string;
  /** Overrides what clicking a link row does. The buffered ActionDialog host passes
   *  save-then-switch (#663); without it the row opens the target's editor directly. */
  onFollowLink?: (targetId: string) => void;
  /** Fires when a nested dialog (resource form, link picker) opens/closes — a hosting dialog
   *  suspends its own save-from-anywhere shortcut while true (the #574 rule; #720). */
  onNestedOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  const editor = useContext(ActionEditorContext);
  const doc = workspace?.document ?? null;
  // The resource dialog's mode: create (editIndex null) or edit the row at an index.
  const [resourceDialog, setResourceDialog] = useState<{ editIndex: number | null } | null>(null);
  // The link picker's mode: append a new link, or replace the link at an index ("…").
  const [linkPicker, setLinkPicker] = useState<{ replaceIndex: number | null } | null>(null);

  // Tell the hosting dialog when any nested modal is up (this also covers the pre-existing link
  // picker, which had the same ⌘Enter hole).
  const nestedOpen = resourceDialog !== null || linkPicker !== null;
  useEffect(() => {
    onNestedOpenChange?.(nestedOpen);
  }, [nestedOpen, onNestedOpenChange]);

  function submitResource(resource: Resource) {
    const i = resourceDialog?.editIndex;
    if (i != null) onChange(resources.map((r, idx) => (idx === i ? resource : r)));
    else onChange([...resources, resource]);
  }

  function pickLink(targetId: string) {
    const link = makeActionLink(targetId);
    // One link per target (#663): a repeat pick is a no-op; re-picking an existing target via
    // "…" collapses to the already-present row (the replaced row is dropped).
    const existsAt = resources.findIndex((r) => parseActionLink(r) === targetId);
    if (linkPicker?.replaceIndex != null) {
      const i = linkPicker.replaceIndex;
      if (existsAt !== -1 && existsAt !== i) onChange(resources.filter((_, idx) => idx !== i));
      else onChange(resources.map((r, idx) => (idx === i ? link : r)));
    } else if (existsAt === -1) {
      onChange([...resources, link]);
    }
    setLinkPicker(null);
  }

  /** The "…" opener every row starts with — the one edit affordance (#720). */
  function editButton(label: string, onClick: () => void) {
    return (
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="shrink-0 rounded-md px-1.5 text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    );
  }

  function removeButton(value: string, i: number) {
    return (
      <button
        type="button"
        aria-label={t('editor.removeResourceAria', { value })}
        onClick={() => onChange(resources.filter((_, idx) => idx !== i))}
        className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
      >
        ×
      </button>
    );
  }

  function linkRow(r: Resource, i: number, targetId: string) {
    const target = doc?.nodes[targetId];
    const label = target
      ? [...projectPath(doc!, targetId), target.title].join(' › ')
      : t('editor.linkGone');
    return (
      <li key={i} className="flex items-center gap-2 text-sm">
        {editButton(t('editor.editLinkAria'), () => setLinkPicker({ replaceIndex: i }))}
        <Link2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {target ? (
          <button
            type="button"
            onClick={() => (onFollowLink ? onFollowLink(targetId) : editor?.openEditor(targetId))}
            aria-label={t('editor.openLinkAria', { title: target.title })}
            className="min-w-0 flex-1 truncate text-left text-foreground underline-offset-2 hover:underline"
          >
            {label}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate italic text-muted-foreground">{label}</span>
        )}
        {removeButton(target ? target.title : r.value, i)}
      </li>
    );
  }

  return (
    <div className="space-y-1.5">
      {resources.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {resources.map((r, i) => {
            const targetId = doc ? parseActionLink(r) : null;
            if (targetId) return linkRow(r, i, targetId);
            // COUNT rows (#798): the pill + a buffered +1 (editor semantics — saves on Save;
            // the in-the-flow immediate tap lives on the action row's pill instead).
            const count = r.type === 'COUNT' ? parseCount(r.value) : null;
            if (count) {
              const label = r.description?.trim() ? r.description : t('editor.resourceCountFallback');
              const full = count.current >= count.target;
              return (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {editButton(t('editor.editResourceAria', { value: label }), () => setResourceDialog({ editIndex: i }))}
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{t('resourceType.COUNT')}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
                  <span className={full ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-600' : 'rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground'}>
                    {r.value}
                  </span>
                  {!full && (
                    <button
                      type="button"
                      aria-label={t('editor.resourceCountPlusAria', { label })}
                      onClick={() =>
                        onChange(resources.map((res, idx) => (idx === i ? { ...res, value: formatCount(count.current + 1, count.target) } : res)))
                      }
                      className="rounded-md border border-input px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      +1
                    </button>
                  )}
                  {removeButton(label, i)}
                </li>
              );
            }
            // http(s) links open the browser (#715); the display name (description) shows when
            // set, the raw value otherwise — hovering always reveals the underlying value.
            const isHttp = r.type === 'URI' && /^https?:\/\//i.test(r.value);
            const display = r.description?.trim() ? r.description : r.value;
            return (
              <li key={i} className="flex items-center gap-2 text-sm">
                {editButton(t('editor.editResourceAria', { value: display }), () => setResourceDialog({ editIndex: i }))}
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{r.type}</span>
                {isHttp ? (
                  <Tooltip label={r.value}>
                    <a
                      href={r.value}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="min-w-0 flex-1 truncate text-foreground underline-offset-2 hover:underline"
                    >
                      {display}
                    </a>
                  </Tooltip>
                ) : (
                  <Tooltip label={display !== r.value ? r.value : undefined}>
                    <span className="min-w-0 flex-1 truncate text-foreground">{display}</span>
                  </Tooltip>
                )}
                <CopyButton value={r.value} label={t('copy.resource', { value: r.value })} tooltip />
                {removeButton(r.value, i)}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t('editor.noResources')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setResourceDialog({ editIndex: null })}>
          <Plus className="h-3.5 w-3.5" />
          {t('editor.addResource')}
        </Button>
        {doc && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setLinkPicker({ replaceIndex: null })}>
            <Link2 className="h-3.5 w-3.5" />
            {t('editor.linkAction')}
          </Button>
        )}
      </div>
      {resourceDialog && (
        <ResourceDialog
          open
          onOpenChange={(open) => {
            if (!open) setResourceDialog(null);
          }}
          initial={resourceDialog.editIndex != null ? resources[resourceDialog.editIndex] : null}
          onSubmit={submitResource}
        />
      )}
      {doc && (
        <ProjectPickerDialog
          open={linkPicker !== null}
          onOpenChange={(open) => {
            if (!open) setLinkPicker(null);
          }}
          title={t('editor.linkActionTitle')}
          confirmLabel={t('editor.linkPick')}
          targets={allOpenableActions(doc).filter((a) => a.id !== linkExcludeId)}
          mode="actions"
          onConfirm={pickLink}
        />
      )}
    </div>
  );
}
