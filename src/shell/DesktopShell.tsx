import { useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useCapture } from '@/capture/capture-context';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/app';
import { SURFACES } from './nav';
import { ShellContent } from './ShellContent';
import { SyncNotice } from './SyncNotice';
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useSidebarLayout,
} from './useSidebarLayout';

/** Laptop/desktop: resizable, collapsible sidebar with every surface (parity-ready) + content area. */
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

  if (collapsed) {
    return (
      <div className="flex min-h-dvh bg-background text-foreground">
        <div className="flex min-w-0 flex-1 flex-col">
          <SyncNotice />
          <main className="flex-1 overflow-y-auto px-6 py-8">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Expand sidebar"
              onClick={toggleCollapsed}
              className="fixed left-2 top-2 z-20"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
            <div className="mx-auto max-w-2xl">
              <ShellContent />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside style={{ width }} className="flex shrink-0 flex-col p-4">
        <div className="flex items-center justify-between px-2">
          <h1 className="text-lg font-semibold tracking-tight">{APP_NAME}</h1>
          <Button variant="ghost" size="icon" aria-label="Collapse sidebar" onClick={toggleCollapsed}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <Button className="mt-4 justify-start gap-2" onClick={openCapture}>
          <Plus />
          Capture
        </Button>

        <nav aria-label="Sidebar" className="mt-4 flex flex-col gap-1">
          {SURFACES.map(({ to, label, icon: Icon }) => (
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

        <div className="mt-auto flex items-center justify-between pt-4">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
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
        className="w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-ring focus-visible:bg-ring focus-visible:outline-none"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <SyncNotice />
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-2xl">
            <ShellContent />
          </div>
        </main>
      </div>
    </div>
  );
}
