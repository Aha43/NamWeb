import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Inbox, ListTodo, MoreHorizontal, Plus, Target, type LucideIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SURFACES } from './nav';
import { ShellContent } from './ShellContent';
import { SyncNotice } from './SyncNotice';

/** Phone: capture + execution pushed to the front; everything else lives in the More sheet. */
export function PhoneShell({ onSignOut }: { onSignOut: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">NamWeb</h1>
      </header>

      <SyncNotice />

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <ShellContent />
      </main>

      <nav
        aria-label="Primary"
        className="sticky bottom-0 grid grid-cols-5 items-end border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <BottomLink to="/inbox" label="Inbox" icon={Inbox} />
        <BottomLink to="/next" label="Next" icon={ListTodo} />

        {/* Capture — the headline action, front and center. TODO(#19): open a capture sheet. */}
        <div className="flex justify-center">
          <button
            type="button"
            aria-label="Capture"
            onClick={() => navigate('/inbox')}
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        <BottomLink to="/focus" label="Focus" icon={Target} />

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Jump to any surface, or manage your session.</SheetDescription>
          </SheetHeader>

          <nav aria-label="More" className="mt-4 flex flex-col gap-1">
            {SURFACES.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BottomLink({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  );
}
