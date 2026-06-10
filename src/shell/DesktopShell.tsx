import { NavLink } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useCapture } from '@/capture/capture-context';
import { cn } from '@/lib/utils';
import { SURFACES } from './nav';
import { ShellContent } from './ShellContent';
import { SyncNotice } from './SyncNotice';

/** Laptop/desktop: persistent sidebar with every surface (parity-ready) + content area. */
export function DesktopShell({ onSignOut }: { onSignOut: () => void }) {
  const { openCapture } = useCapture();

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border p-4">
        <h1 className="px-2 text-lg font-semibold tracking-tight">NamWeb</h1>

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
