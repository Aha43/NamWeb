import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import type { Resource, ResourceType } from '@/domain/types';
import { makeActionLink, parseActionLink } from '@/domain/actionLinks';
import { allOpenableActions, projectPath } from '@/domain/lenses';
import { WorkspaceContext } from '@/store/workspace-context';
import { ActionEditorContext } from './action-editor-context';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';

const RESOURCE_TYPES: ResourceType[] = ['URI', 'EMAIL', 'FILE', 'TEXT'];

/** Add/remove attached resources (links/files/notes). Local edits are reported via onChange and
 *  committed by the surrounding editor (the action dialog, or the project workbench Details panel).
 *  FILE is link/metadata only (no upload).
 *
 *  Action links (#658) are URI resources with the nam:// scheme: the row shows the target's live
 *  breadcrumb path (click opens its editor), "…" re-picks the target, ✕ unlinks. Both contexts are
 *  optional — without a workspace provider (presentational tests) links render as raw URIs. */
export function ResourcesEditor({
  resources,
  onChange,
  linkExcludeId,
}: {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
  /** The hosting node — excluded from the link picker so a card can't link to itself. */
  linkExcludeId?: string;
}) {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  const editor = useContext(ActionEditorContext);
  const doc = workspace?.document ?? null;
  const [type, setType] = useState<ResourceType>('URI');
  const [value, setValue] = useState('');
  // The link picker's mode: append a new link, or replace the link at an index ("…").
  const [linkPicker, setLinkPicker] = useState<{ replaceIndex: number | null } | null>(null);

  function add() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onChange([...resources, { type, value: trimmed, description: null }]);
    setValue('');
  }

  function pickLink(targetId: string) {
    const link = makeActionLink(targetId);
    if (linkPicker?.replaceIndex != null) {
      onChange(resources.map((r, idx) => (idx === linkPicker.replaceIndex ? link : r)));
    } else {
      onChange([...resources, link]);
    }
    setLinkPicker(null);
  }

  function linkRow(r: Resource, i: number, targetId: string) {
    const target = doc?.nodes[targetId];
    const label = target
      ? [...projectPath(doc!, targetId), target.title].join(' › ')
      : t('editor.linkGone');
    return (
      <li key={i} className="flex items-center gap-2 text-sm">
        <Link2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {target ? (
          <button
            type="button"
            onClick={() => editor?.openEditor(targetId)}
            aria-label={t('editor.openLinkAria', { title: target.title })}
            className="min-w-0 flex-1 truncate text-left text-foreground underline-offset-2 hover:underline"
          >
            {label}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate italic text-muted-foreground">{label}</span>
        )}
        <Tooltip label={t('editor.editLinkAria')}>
          <button
            type="button"
            aria-label={t('editor.editLinkAria')}
            onClick={() => setLinkPicker({ replaceIndex: i })}
            className="rounded-md px-1.5 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <button
          type="button"
          aria-label={t('editor.removeResourceAria', { value: target ? target.title : r.value })}
          onClick={() => onChange(resources.filter((_, idx) => idx !== i))}
          className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
        >
          ×
        </button>
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
            return (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{r.type}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{r.value}</span>
                <CopyButton value={r.value} label={t('copy.resource', { value: r.value })} />
                <button
                  type="button"
                  aria-label={t('editor.removeResourceAria', { value: r.value })}
                  onClick={() => onChange(resources.filter((_, idx) => idx !== i))}
                  className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t('editor.noResources')}</p>
      )}
      <div className="flex gap-2">
        <select
          aria-label={t('editor.resourceType')}
          value={type}
          onChange={(e) => setType(e.target.value as ResourceType)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
        >
          {RESOURCE_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {rt}
            </option>
          ))}
        </select>
        <Input
          aria-label={t('editor.resourceValue')}
          placeholder={t('editor.resourcePlaceholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          {t('common.add')}
        </Button>
        {doc && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setLinkPicker({ replaceIndex: null })}>
            <Link2 className="h-3.5 w-3.5" />
            {t('editor.linkAction')}
          </Button>
        )}
      </div>
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
