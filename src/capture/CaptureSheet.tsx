import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, CheckSquare, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { CopyButton } from '@/components/ui/copy-button';
import { Tooltip } from '@/components/ui/tooltip';
import { InlineRename } from '@/features/actions/InlineRename';
import { useDeleteNode, useDeleteNodes } from '@/features/actions/useDeleteNode';
import { ProjectPickerDialog } from '@/features/projects/picker/ProjectPickerDialog';
import type { ProcessResolution, ProjectTarget } from '@/features/inbox/InboxProcessDialog';
import { archivedProjectIds, projectPath } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import { cn } from '@/lib/utils';
import { TOUCH_TARGET } from '@/lib/touch';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useSettings } from '@/components/settings/settings-context';
import { useIsDesktop } from '@/shell/useIsDesktop';
import type { NamNode } from '@/domain/types';

/** Clicking the delete-Undo toast is an "interact outside" for the modal capture surface — don't
 *  let it close the dialog/sheet mid-streak (#617). Toast rows render as role="status". */
function keepOpenForToast(event: { detail: { originalEvent: Event }; preventDefault: () => void }) {
  const target = event.detail.originalEvent.target;
  if (target instanceof Element && target.closest('[role="status"]')) event.preventDefault();
}

// Remembered dialog size (#626) — the desktop dialog opens at its default size until the user
// drags the corner handle; from then on it opens at the dragged size (per device, best-effort).
const CAPTURE_SIZE_KEY = 'namweb.capture.size';
interface CaptureSize {
  width: number;
  height: number;
}
const MIN_SIZE: CaptureSize = { width: 360, height: 280 };

/** Clamp to the current viewport (with a small margin), so a size dragged on a big screen can't
 *  open a dialog larger than a smaller screen. */
function clampSize(size: CaptureSize): CaptureSize {
  return {
    width: Math.round(Math.min(Math.max(size.width, MIN_SIZE.width), window.innerWidth - 32)),
    height: Math.round(Math.min(Math.max(size.height, MIN_SIZE.height), window.innerHeight - 32)),
  };
}

function readSize(): CaptureSize | null {
  try {
    const stored = localStorage.getItem(CAPTURE_SIZE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as CaptureSize;
    if (Number.isFinite(parsed.width) && Number.isFinite(parsed.height)) return clampSize(parsed);
  } catch {
    // localStorage unavailable / stale garbage — open at the default size.
  }
  return null;
}

/**
 * Always-available quick capture. Stays open so you can add several in a row. On desktop it's a
 * centered modal dialog; on phones a bottom sheet (better thumb reach).
 *
 * Below the field, every item captured *this session* stays visible (so a fast streak doesn't
 * "just disappear") and is editable inline to fix a typo. Long streaks scroll in the list region
 * only — the capture field never scrolls away (#622). The list is session-only — it resets when
 * the dialog closes — but titles render live from the document, so an edit renames the real inbox
 * item and a row drops off if that item is deleted elsewhere.
 *
 * The list is also a **processing station** (#623): when a streak lands in one domain you often
 * already know how to triage it — select rows and file them somewhere with a status, exactly like
 * inbox bulk triage (same intents, same toolbar verbs), without the roundtrip through the inbox.
 * Processed rows stay listed with a ✓-marker as confirmation of where they went.
 */
export function CaptureSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const { document, dispatch } = useWorkspaceContext();
  const { addToBottom } = useSettings();
  const deleteNode = useDeleteNode();
  const deleteNodes = useDeleteNodes();
  const isDesktop = useIsDesktop();
  const [title, setTitle] = useState('');
  // Ids captured during this open; newest first. Cleared when the dialog closes (non-persisted).
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Bulk processing (#623) — mirrors InboxPanel's select mode (#458).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState(''); // '' = default (Free actions / Top level)
  const [pickerOpen, setPickerOpen] = useState(false);
  // Where each processed id went (session-only marker text, e.g. "Next · Home › Garage").
  const [processed, setProcessed] = useState<Map<string, string>>(new Map());
  // Remembered dialog size (#626); null = the default (max-w-lg, content height).
  const [size, setSizeState] = useState<CaptureSize | null>(readSize);
  const setSize = useCallback((next: CaptureSize) => {
    const clamped = clampSize(next);
    setSizeState(clamped);
    try {
      localStorage.setItem(CAPTURE_SIZE_KEY, JSON.stringify(clamped));
    } catch {
      // best-effort persistence
    }
  }, []);

  // Drag the bottom-right corner via pointer capture: while captured, every move routes to the
  // handle wherever the pointer is, and release/unmount ends the drag with nothing to clean up.
  // The dialog is centered (translate -50%), so the size that keeps the corner under the pointer
  // is twice the pointer's distance from the viewport center.
  const onResizeStart = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);
  const onResizeMove = useCallback(
    (event: React.PointerEvent) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      setSize({
        width: 2 * (event.clientX - window.innerWidth / 2),
        height: 2 * (event.clientY - window.innerHeight / 2),
      });
    },
    [setSize],
  );

  const onResizeKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const current = size ?? { width: 512, height: 400 }; // ~max-w-lg as the keyboard baseline
      if (event.key === 'ArrowRight') setSize({ ...current, width: current.width + 16 });
      else if (event.key === 'ArrowLeft') setSize({ ...current, width: current.width - 16 });
      else if (event.key === 'ArrowDown') setSize({ ...current, height: current.height + 16 });
      else if (event.key === 'ArrowUp') setSize({ ...current, height: current.height - 16 });
      else return;
      event.preventDefault();
    },
    [size, setSize],
  );

  useEffect(() => {
    if (!open) {
      setRecentIds([]);
      setRenamingId(null);
      setSelectMode(false);
      setSelected(new Set());
      setBulkTarget('');
      setPickerOpen(false);
      setProcessed(new Map());
    }
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const id = newId();
    dispatch({ type: 'addInboxItem', id, title: trimmed, atTop: !addToBottom, now: nowIso() });
    setRecentIds((prev) => [id, ...prev]);
    setTitle('');
  }

  function rename(id: string, nextTitle: string) {
    const node = document?.nodes[id];
    if (node) dispatch({ type: 'updateNode', id, title: nextTitle, description: node.description, now: nowIso() });
  }

  // Live lookup so edits/deletions elsewhere reflect immediately; drop ids whose node is gone.
  const recentNodes = recentIds
    .map((id) => document?.nodes[id])
    .filter((n): n is NamNode => Boolean(n));
  const unprocessed = recentNodes.filter((n) => !processed.has(n.id));

  // All non-archived projects for the bulk "File into" picker (same set as inbox bulk triage).
  const projectTargets = useMemo<ProjectTarget[]>(() => {
    if (!document) return [];
    const archived = archivedProjectIds(document);
    const targets: ProjectTarget[] = [];
    for (const candidate of Object.values(document.nodes)) {
      if (!candidate.project || archived.has(candidate.id)) continue;
      targets.push({ id: candidate.id, label: [...projectPath(document, candidate.id), candidate.title].join(' › ') });
    }
    return targets;
  }, [document]);

  // Create a project (under `parentId`, or top level) and return its id — the picker's "New
  // project here", same shape as InboxPage's.
  const createProject = (parentId: string | null, title: string): string => {
    if (!document) return '';
    const id = newId();
    dispatch({
      type: 'addSubProject',
      parentId: parentId ?? document.projectsNodeId,
      id,
      title,
      atTop: !addToBottom,
      now: nowIso(),
    });
    return id;
  };

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
    setBulkTarget('');
  };
  const none = selected.size === 0;
  const parentId = bulkTarget || undefined;
  const targetLabel = bulkTarget
    ? (projectTargets.find((pt) => pt.id === bulkTarget)?.label ?? t('inbox.fallbackProject'))
    : t('inbox.freeActionsTarget');

  // Apply one shared resolution to the selected captures — the same intents as inbox bulk triage
  // (they move the item out of the inbox and set status; no per-item undo, matching inbox #458).
  function resolveSelected(resolution: ProcessResolution) {
    const now = nowIso();
    const suffix = bulkTarget ? ` · ${targetLabel}` : '';
    const marker =
      resolution.kind === 'project'
        ? `${t('capture.processedProject')}${suffix}`
        : `${t(resolution.status === 'NEXT' ? 'domain.status.next' : 'domain.status.backlog')}${suffix}`;
    setProcessed((prev) => {
      const next = new Map(prev);
      for (const id of selected) next.set(id, marker);
      return next;
    });
    for (const id of selected) {
      if (resolution.kind === 'project') {
        dispatch({ type: 'convertInboxToProject', id, parentId: resolution.parentId, now });
      } else {
        dispatch({ type: 'convertInboxToAction', id, status: resolution.status, parentId: resolution.parentId, now });
      }
    }
    setSelected(new Set());
  }

  // No Add button (#626): Enter (or the phone keyboard's Go) submits — a visible button is dead
  // weight and teaches the slow path. A single-input form implicitly submits on Enter.
  const form = (
    <form onSubmit={submit} className="mt-4 flex gap-2">
      <input
        aria-label={t('capture.inputAria')}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('capture.placeholder')}
        className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
      />
    </form>
  );

  // The list is the only scroll region (min-h-0 + overflow-y-auto): however long the streak, the
  // header, capture field, and the processing toolbar stay put (#622).
  const recentList =
    recentNodes.length > 0 ? (
      <div className="mt-4 flex min-h-0 flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{t('capture.justAdded')}</p>
          <Tooltip label={selectMode ? t('inbox.exitSelect') : t('inbox.selectItems')}>
            <button
              type="button"
              aria-label={selectMode ? t('inbox.exitSelect') : t('inbox.selectItems')}
              aria-pressed={selectMode}
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              className={cn(
                'rounded-md p-1.5 hover:bg-accent hover:text-foreground',
                TOUCH_TARGET,
                selectMode ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <CheckSquare className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>

        {selectMode && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
            <span className="mr-1 text-muted-foreground">{t('actions.selectedCount', { count: selected.size })}</span>
            {/* Destination first: the verbs below file into whatever this is set to. */}
            <Tooltip label={t('inbox.fileIntoTooltip', { target: targetLabel })}>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="max-w-[14rem] truncate rounded-md border border-input px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {t('inbox.fileInto')} <span className="font-medium text-foreground">{targetLabel}</span> ▾
              </button>
            </Tooltip>
            <button
              type="button"
              disabled={none}
              onClick={() => resolveSelected({ kind: 'action', status: 'NEXT', parentId })}
              className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              → {t('domain.status.next')}
            </button>
            <button
              type="button"
              disabled={none}
              onClick={() => resolveSelected({ kind: 'action', status: 'BACKLOG', parentId })}
              className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              → {t('domain.status.backlog')}
            </button>
            <button
              type="button"
              disabled={none}
              onClick={() => resolveSelected({ kind: 'project', parentId })}
              className="rounded-md px-2 py-0.5 font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              {t('inbox.makeProjects')}
            </button>
            <ConfirmButton
              aria-label={t('inbox.deleteSelectedAria')}
              message={t('inbox.deleteSelectedConfirm', { count: selected.size })}
              onConfirm={() => {
                deleteNodes([...selected]);
                setSelected(new Set());
              }}
              disabled={none}
              className="rounded-md px-2 py-0.5 font-medium text-destructive hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              {t('common.delete')}
            </ConfirmButton>
            <button
              type="button"
              onClick={() => setSelected(new Set(unprocessed.map((n) => n.id)))}
              disabled={selected.size === unprocessed.length}
              className="ml-auto rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              {t('common.selectAll')}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={none}
              className="rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              {t('common.clear')}
            </button>
          </div>
        )}

        <ul className="min-h-0 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {recentNodes.map((node) => {
            const marker = processed.get(node.id);
            return (
              <li key={node.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                {selectMode && !marker && (
                  <input
                    type="checkbox"
                    aria-label={t('inbox.selectItemAria', { title: node.title })}
                    checked={selected.has(node.id)}
                    onChange={() => toggle(node.id)}
                    className="shrink-0"
                  />
                )}
                {renamingId === node.id ? (
                  <div className="min-w-0 flex-1">
                    <InlineRename
                      title={node.title}
                      onCommit={(newTitle) => {
                        rename(node.id, newTitle);
                        setRenamingId(null);
                      }}
                      onCancel={() => setRenamingId(null)}
                    />
                  </div>
                ) : marker ? (
                  <>
                    {/* Processed: the row stays as confirmation of where it went; no further ops. */}
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{node.title}</span>
                    <span className="flex min-w-0 shrink-0 items-center gap-1 truncate text-xs text-muted-foreground">
                      <Check aria-hidden className="h-3.5 w-3.5 text-[#3FA463]" />
                      {marker}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-foreground">{node.title}</span>
                    {!selectMode && (
                      <>
                        <CopyButton value={node.title} label={t('copy.name', { title: node.title })} tooltip />
                        <button
                          type="button"
                          aria-label={t('actions.editAria', { title: node.title })}
                          onClick={() => setRenamingId(node.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {/* No confirm — these are seconds-old leaf captures and the toast offers Undo. */}
                        <button
                          type="button"
                          aria-label={t('actions.deleteAria', { title: node.title })}
                          onClick={() => deleteNode(node.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  const picker = pickerOpen && (
    <ProjectPickerDialog
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      title={t('inbox.fileUnderTitle')}
      confirmLabel={t('common.choose')}
      targets={[{ id: '', label: t('inbox.defaultTarget') }, ...projectTargets]}
      initialSelectedId={bulkTarget}
      onConfirm={setBulkTarget}
      onCreateProject={createProject}
    />
  );

  const description = t('capture.description');

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* flex-col + overflow-hidden: the content itself never scrolls (the default DialogContent
            behavior would scroll the capture field away on a long streak) — only the list does.
            transition-none: the base duration-200 would otherwise ease width/height 200ms behind
            the corner drag (transition-property defaults to `all`); open/close stay animated —
            those are CSS animations, not transitions. */}
        <DialogContent
          className="flex flex-col overflow-hidden transition-none"
          style={size ? { width: size.width, maxWidth: size.width, height: size.height } : undefined}
          onInteractOutside={keepOpenForToast}
        >
          <DialogHeader>
            <DialogTitle>{t('nav.capture')}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {form}
          {recentList}
          {picker}
          {/* Corner resize handle (#626): drag (or arrow keys) to size the dialog; remembered. */}
          <div
            role="separator"
            aria-label={t('capture.resize')}
            tabIndex={0}
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onKeyDown={onResizeKeyDown}
            className="absolute bottom-0.5 right-0.5 h-4 w-4 cursor-nwse-resize text-muted-foreground/60 hover:text-foreground focus-visible:text-foreground focus-visible:outline-hidden"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4">
              <path d="M14 8 L8 14 M14 12 L12 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The bottom sheet is content-height with no cap of its own — bound it so a long streak
          scrolls in the list instead of growing past the top of the viewport. */}
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col overflow-hidden" onInteractOutside={keepOpenForToast}>
        <SheetHeader>
          <SheetTitle>{t('nav.capture')}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {form}
        {recentList}
        {picker}
      </SheetContent>
    </Sheet>
  );
}
