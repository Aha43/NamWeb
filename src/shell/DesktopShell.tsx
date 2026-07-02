import { useCallback } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ListTodo, PanelLeftClose, PanelLeftOpen, Plus, Search, Tag, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { AccountMenu } from './AccountMenu';
import { BookmarkBar } from '@/features/bookmarks/BookmarkBar';
import { useCapture } from '@/capture/capture-context';
import { LogoMark } from '@/components/brand/LogoMark';
import { cn } from '@/lib/utils';
import { APP_SHORT_NAME, brandTooltip } from '@/lib/app';
import { SIDEBAR_GROUPS, focus, next, tags } from './nav';
import { TOOLBAR_SEARCH_ID } from './useGlobalShortcuts';
import { ShellContent } from './ShellContent';
import { SyncNotice } from './SyncNotice';
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useSidebarLayout,
} from './useSidebarLayout';

/** Laptop/desktop: a top toolbar (search + tags + theme + account) over a resizable, collapsible
 *  view-list sidebar (grouped) and the workspace. */
export function DesktopShell({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation();
  const { openCapture } = useCapture();
  const { width, collapsed, setWidth, toggleCollapsed } = useSidebarLayout();

  // Drag the divider: track the pointer on the document until release, then clean up.
  const onResizeStart = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;
      const onMove = (e: PointerEvent) => setWidth(startWidth + (e.clientX - startX));
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [width, setWidth],
  );

  // Keyboard a11y for the divider: nudge width with the arrow keys.
  const onResizeKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setWidth(width - 16);
      else if (event.key === 'ArrowRight') setWidth(width + 16);
    },
    [width, setWidth],
  );

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
              onClick={toggleCollapsed}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </Tooltip>
          <ToolbarSearch />
          <BookmarkBar />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <AccountMenu onSignOut={onSignOut} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {!collapsed && (
          <>
            <aside style={{ width }} className="flex shrink-0 flex-col overflow-y-auto p-4">
              <div className="flex items-center gap-2 px-2">
                <LogoMark className="h-7 w-7 shrink-0 text-foreground" />
                <Tooltip label={brandTooltip()}>
                  <h1 className="truncate text-lg font-semibold tracking-tight">{APP_SHORT_NAME}</h1>
                </Tooltip>
              </div>

              {/* Foregrounded actions (mirrors the phone bottom bar): capture, jump to Next / Contexts
                  (the two most-used surfaces), and Focus. Distinct colors so each is quick to find. */}
              <div className="mt-4 flex flex-col gap-2">
                <Tooltip label={t('nav.captureTooltip')}>
                  <Button className="justify-start gap-2" onClick={openCapture}>
                    <Plus />
                    {t('nav.capture')}
                  </Button>
                </Tooltip>
                <Tooltip label={t(next.hint!)}>
                  <Button asChild className="justify-start gap-2 bg-blue-600 text-white hover:bg-blue-700">
                    <NavLink to={next.to}>
                      <ListTodo />
                      {t(next.label)}
                    </NavLink>
                  </Button>
                </Tooltip>
                <Tooltip label={t(tags.hint!)}>
                  <Button asChild className="justify-start gap-2 bg-violet-600 text-white hover:bg-violet-700">
                    <NavLink to={tags.to}>
                      <Tag />
                      {t(tags.label)}
                    </NavLink>
                  </Button>
                </Tooltip>
                <Tooltip label={t(focus.hint!)}>
                  <Button asChild variant="outline" className="justify-start gap-2">
                    <NavLink to="/focus">
                      <Target className="focus-glow" />
                      {t('domain.focus')}
                    </NavLink>
                  </Button>
                </Tooltip>
              </div>

              <nav aria-label={t('nav.sidebarLandmark')} className="mt-5 flex flex-col gap-4">
                {SIDEBAR_GROUPS.map((group, i) => (
                  <div key={group.label ?? i} className="flex flex-col gap-1">
                    {group.label && (
                      <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                        {t(group.label)}
                      </span>
                    )}
                    {group.items.map(({ to, label, icon: Icon, hint }) => (
                      <Tooltip key={to} label={hint ? t(hint) : ''}>
                        {/* Static (string) className + aria-current for the active state — a render-prop
                            className breaks when the Tooltip's asChild Slot clones the NavLink. */}
                        <NavLink
                          to={to}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                            'aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {t(label)}
                        </NavLink>
                      </Tooltip>
                    ))}
                  </div>
                ))}
              </nav>
            </aside>

            {/* Draggable divider between the view list and the workspace. */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('nav.resizeSidebar')}
              aria-valuenow={width}
              aria-valuemin={SIDEBAR_MIN_WIDTH}
              aria-valuemax={SIDEBAR_MAX_WIDTH}
              tabIndex={0}
              onPointerDown={onResizeStart}
              onKeyDown={onResizeKeyDown}
              onDoubleClick={() => setWidth(SIDEBAR_DEFAULT_WIDTH)}
              title={t('nav.resizeSidebarTitle')}
              className="w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-ring focus-visible:bg-ring focus-visible:outline-hidden"
            />
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <SyncNotice />
          <main className="min-h-0 flex-1 overflow-auto px-6 py-8">
            {/* Single width knob for all workspace content: full-width fill. Cap here (e.g.
                max-w-6xl) if a wide screen ever feels too roomy — panels no longer cap themselves. */}
            <div className="mx-auto w-full">
              <ShellContent />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/** Toolbar search box: drives the Search surface via the `?q=` URL param so results show live.
 *  The box persists across routes (it lives outside the routed Outlet), so focus is kept while typing. */
function ToolbarSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onSearch = location.pathname === '/search';
  const value = onSearch ? (params.get('q') ?? '') : '';

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={TOOLBAR_SEARCH_ID}
        type="search"
        aria-label={t('nav.searchWorkspace')}
        value={value}
        onChange={(e) => {
          const q = e.target.value;
          navigate(
            { pathname: '/search', search: q ? `?q=${encodeURIComponent(q)}` : '' },
            { replace: onSearch },
          );
        }}
        placeholder={t('nav.searchPlaceholder')}
        className="w-44 rounded-md border border-input bg-background py-1.5 pl-8 pr-7 text-sm outline-hidden focus:border-ring sm:w-64"
      />
      {/* Discoverability: the "/" shortcut focuses this box (see useGlobalShortcuts). */}
      <kbd
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1 text-[10px] text-muted-foreground"
      >
        /
      </kbd>
    </div>
  );
}
