import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PromptButton } from '@/components/ui/prompt-button';
import { Tooltip } from '@/components/ui/tooltip';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useSettings } from '@/components/settings/settings-context';
import { isTypingTarget } from '@/shell/useGlobalShortcuts';
import { buildPath, projectPath } from '@/domain/lenses';
import { bookmarksOf, isBookmarkStale } from '@/features/bookmarks/bookmarks';
import { cn } from '@/lib/utils';
import { childColumn, rootColumn, type PickerItem, type PickerTarget } from './pickerModel';

export interface ProjectPickerColumnsProps {
  /** The valid destinations the caller already computes ({id,label}); defines what's selectable. */
  targets: PickerTarget[];
  /** Optionally pre-highlight a destination (e.g. the current parent). */
  initialSelectedId?: string;
  /** Mount with the columns already navigated to this project (ancestors opened, it selected) —
   *  browsing *from* a starting point, e.g. a bookmarked hub (#595). Overrides initialSelectedId. */
  initialProjectId?: string;
  /** Fires whenever the confirmable destination changes: a selectable id, or null. */
  onSelectionChange?: (id: string | null) => void;
  /** A definitive pick — double-click, ⌘/Ctrl+Enter, or "New project here". The host decides what
   *  that means (close a dialog, advance a wizard step, …). */
  onPick: (id: string) => void;
  /** Enables "New project here" (create under the navigated-into project or top level; returns the
   *  new id, which is then delivered via `onPick`). */
  onCreateProject?: (parentId: string | null, title: string) => string;
  /** Height/growth of the columns strip. Default `h-72`; pass e.g. `min-h-0 flex-1` to fill a
   *  flex column (the capture wizard's resizable dialog). */
  columnsClassName?: string;
}

/**
 * The macOS Finder-style **column (Miller) view** for choosing a destination project — the inner,
 * shell-free part of the picker (#635): bookmark quick-jump chips, the columns, the breadcrumb of
 * the current selection, and "New project here". `ProjectPickerDialog` wraps it in a modal with
 * Cancel/confirm; the capture wizard embeds it as its destination step.
 *
 * Navigation state initializes at mount (the #607 lesson, restated: `document`/`targets` change
 * identity whenever the workspace re-renders, and re-initializing then would wipe the drilled-in
 * trail — so hosts mount it fresh per open/step and nothing re-initializes after that).
 */
export function ProjectPickerColumns({
  targets,
  initialSelectedId,
  initialProjectId,
  onSelectionChange,
  onPick,
  onCreateProject,
  columnsClassName,
}: ProjectPickerColumnsProps) {
  const { t } = useTranslation();
  const { document } = useWorkspaceContext();
  const { bookmarkStyle } = useSettings();
  const allowed = useMemo(() => new Set(targets.map((tg) => tg.id)), [targets]);

  // The chain of opened project ids forming columns 1..n (column 0 is always the roots).
  // Lazy initializers = mount-time navigation, immune to mid-open workspace churn (#607).
  const [trail, setTrail] = useState<string[]>(() => {
    if (initialProjectId && document?.nodes[initialProjectId]) {
      const ancestorIds = buildPath(document, initialProjectId).map((n) => n.id);
      const hasChildren = childColumn(document, initialProjectId, allowed).length > 0;
      return hasChildren ? [...ancestorIds, initialProjectId] : ancestorIds;
    }
    return [];
  });
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialProjectId && document?.nodes[initialProjectId] ? initialProjectId : (initialSelectedId ?? null),
  );

  const canConfirm = selectedId !== null && allowed.has(selectedId);

  // Tell the host about confirmable-destination changes (latest callback via ref, so a host that
  // recreates the function each render doesn't retrigger the effect).
  const selectionChangeRef = useRef(onSelectionChange);
  selectionChangeRef.current = onSelectionChange;
  useEffect(() => {
    selectionChangeRef.current?.(canConfirm ? selectedId : null);
  }, [selectedId, canConfirm]);

  // ⌘/Ctrl+Enter is a definitive pick (mirrors the editor's save shortcut). The ref keeps the
  // latest closure without re-subscribing. NB: `document` is shadowed by the workspace document —
  // listen on `window`.
  const pickRef = useRef<() => void>(() => {});
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.isComposing) {
        // Not while typing — e.g. the "New project…" prompt's name field (#574).
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        pickRef.current();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Keep the active (right-most) column in view as you drill deeper — or jump via a bookmark, which
  // can add several columns at once. Column count == trail length + 1, so key on trail length.
  const columnsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = columnsRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  }, [trail.length]);

  if (!document) return null;

  const columns: PickerItem[][] = [rootColumn(document, targets, allowed)];
  for (const pid of trail) columns.push(childColumn(document, pid, allowed));

  const select = (level: number, item: PickerItem) => {
    setSelectedId(item.id);
    // Opening a project with sub-projects reveals the next column; anything else ends the trail here.
    if (!item.isSpecial && item.hasChildren) setTrail([...trail.slice(0, level), item.id]);
    else setTrail(trail.slice(0, level));
  };

  // Bookmarked projects offered as quick-jump chips (skip tag-filter bookmarks + gone projects).
  const projectBookmarks = bookmarksOf(document).filter(
    (b) => b.kind === 'project' && b.projectId && !isBookmarkStale(document, b),
  );
  const jumpTo = (projectId: string) => {
    const ancestorIds = buildPath(document, projectId).map((n) => n.id);
    const hasChildren = childColumn(document, projectId, allowed).length > 0;
    setTrail(hasChildren ? [...ancestorIds, projectId] : ancestorIds);
    setSelectedId(projectId);
  };

  const pick = () => {
    if (selectedId && allowed.has(selectedId)) onPick(selectedId);
  };
  pickRef.current = pick; // keep the keydown handler's closure current

  // "New project here": create under the navigated-into project (a selected real project), or at the
  // top level when nothing/a special root is selected. Only offered where that location is a valid
  // destination (so you can't create inside the moving item's own greyed subtree).
  const createParentId = selectedId && document.nodes[selectedId]?.project ? selectedId : null;
  const createParentLabel = createParentId ? document.nodes[createParentId]?.title : null;
  const canCreateHere = Boolean(onCreateProject) && (createParentId === null || allowed.has(createParentId));
  const createProject = (title: string) => {
    const newId = onCreateProject?.(createParentId, title);
    if (newId) onPick(newId);
  };

  const specialLabel = targets.find((tg) => tg.id === selectedId && !document.nodes[tg.id]?.project)?.label;
  const crumb = !selectedId
    ? null
    : specialLabel ??
      [...projectPath(document, selectedId), document.nodes[selectedId]?.title].filter(Boolean).join(' › ');

  return (
    <div className="flex min-h-0 flex-col">
      {projectBookmarks.length > 0 && (
        <div
          aria-label={t('nav.bookmarks')}
          className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2"
        >
          {projectBookmarks.map((b) => (
            // In "icons" mode the label lives in a tooltip (compact); in "labels" mode it's inline.
            <Tooltip key={b.id} label={bookmarkStyle === 'labels' ? '' : b.label}>
              <button
                type="button"
                aria-label={t('picker.jumpToBookmark', { label: b.label })}
                onClick={() => jumpTo(b.projectId!)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border border-input text-xs font-medium text-foreground hover:bg-accent',
                  bookmarkStyle === 'labels' ? 'px-2.5 py-1' : 'p-1.5',
                )}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                {bookmarkStyle === 'labels' && <span className="max-w-[10rem] truncate">{b.label}</span>}
              </button>
            </Tooltip>
          ))}
        </div>
      )}
      <div ref={columnsRef} className={cn('flex h-72 overflow-x-auto', columnsClassName)}>
        {columns.map((items, level) => (
          <ul
            key={level} // columns are positional by depth
            aria-label={level === 0 ? t('domain.projects') : t('picker.subProjects')}
            className="h-full w-52 shrink-0 overflow-y-auto border-r border-border py-1 last:border-r-0"
          >
            {items.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">{t('picker.noSubProjects')}</li>
            ) : (
              items.map((item) => {
                const isOpen = trail[level] === item.id;
                const isSelected = selectedId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-label={item.label}
                      aria-disabled={!item.selectable}
                      aria-current={isSelected || undefined}
                      onClick={() => select(level, item)}
                      onDoubleClick={() => {
                        if (item.selectable) onPick(item.id);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                        isSelected
                          ? 'bg-accent text-accent-foreground'
                          : isOpen
                            ? 'bg-accent/50'
                            : 'hover:bg-accent/40',
                        !item.selectable && 'text-muted-foreground',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hasChildren && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {crumb ?? t('picker.nothingSelected')}
        </span>
        {canCreateHere && (
          <PromptButton
            label={t('picker.newProjectName')}
            placeholder={t('picker.newProjectPlaceholder')}
            submitLabel={t('common.create')}
            onSubmit={createProject}
            className="shrink-0 rounded-md border border-input px-2.5 py-1 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {createParentLabel
              ? t('picker.newProjectIn', { label: createParentLabel })
              : t('picker.newProjectTop')}
          </PromptButton>
        )}
      </div>
    </div>
  );
}
