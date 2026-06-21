import { useCallback } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Plus, Search, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { AccountMenu } from './AccountMenu';
import { useCapture } from '@/capture/capture-context';
import { LogoMark } from '@/components/brand/LogoMark';
import { cn } from '@/lib/utils';
import { APP_NAME, APP_SHORT_NAME } from '@/lib/app';
import { SURFACES } from './nav';
import { ShellContent } from './ShellContent';
import { SyncNotice } from './SyncNotice';
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useSidebarLayout,
} from './useSidebarLayout';

// Search + Tags live in the toolbar now (Tags is more an admin surface than a daily view); the rest
// of the surfaces stay in the sidebar nav.
const SIDEBAR_SURFACES = SURFACES.filter((s) => s.to !== '/search' && s.to !== '/tags');

/** Laptop/desktop: a top toolbar (search + theme + sign out) over a resizable, collapsible
 *  view-list sidebar and the workspace. */
export function DesktopShell({ onSignOut }: { onSignOut: () => void }) {
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
          <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={toggleCollapsed}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </Tooltip>
          <ToolbarSearch />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip label="Tags">
            <NavLink
              to="/tags"
              aria-label="Tags"
              className={({ isActive }) =>
                cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Tag className="h-4 w-4" />
            </NavLink>
          </Tooltip>
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
                <Tooltip label={APP_NAME}>
                  <h1 className="truncate text-lg font-semibold tracking-tight">{APP_SHORT_NAME}</h1>
                </Tooltip>
              </div>

              <Button className="mt-4 justify-start gap-2" onClick={openCapture}>
                <Plus />
                Capture
              </Button>

              <nav aria-label="Sidebar" className="mt-4 flex flex-col gap-1">
                {SIDEBAR_SURFACES.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </aside>

            {/* Draggable divider between the view list and the workspace. */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              aria-valuenow={width}
              aria-valuemin={SIDEBAR_MIN_WIDTH}
              aria-valuemax={SIDEBAR_MAX_WIDTH}
              tabIndex={0}
              onPointerDown={onResizeStart}
              onKeyDown={onResizeKeyDown}
              onDoubleClick={() => setWidth(SIDEBAR_DEFAULT_WIDTH)}
              title="Drag to resize · double-click to reset"
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
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onSearch = location.pathname === '/search';
  const value = onSearch ? (params.get('q') ?? '') : '';

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        aria-label="Search workspace"
        value={value}
        onChange={(e) => {
          const q = e.target.value;
          navigate(
            { pathname: '/search', search: q ? `?q=${encodeURIComponent(q)}` : '' },
            { replace: onSearch },
          );
        }}
        placeholder="Search…"
        className="w-44 rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-sm outline-hidden focus:border-ring sm:w-64"
      />
    </div>
  );
}
