import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { HelpCircle, Inbox, ListTodo, MoreHorizontal, Plus, Settings, Target, User, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCapture } from '@/capture/capture-context';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LogoMark } from '@/components/brand/LogoMark';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { BookmarkBar } from '@/features/bookmarks/BookmarkBar';
import { bookmarksOf } from '@/features/bookmarks/bookmarks';
import { useWorkspaceContext } from '@/store/workspace-context';
import { cn } from '@/lib/utils';
import { APP_SHORT_NAME, brandTooltip } from '@/lib/app';
import { MORE_GROUPS } from './nav';
import { ShellContent } from './ShellContent';
import { SyncNotice } from './SyncNotice';

/** Phone: capture + execution pushed to the front; everything else lives in the More sheet. */
export function PhoneShell({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { openCapture } = useCapture();

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-4 py-3">
        <Tooltip label={brandTooltip()}>
          <LogoMark className="h-7 w-7 shrink-0 text-foreground" />
        </Tooltip>
        <Tooltip label={brandTooltip()}>
          <h1 className="text-lg font-semibold tracking-tight">{APP_SHORT_NAME}</h1>
        </Tooltip>
      </header>

      <SyncNotice />

      <main className="min-h-0 flex-1 overflow-auto px-4 py-6">
        <ShellContent />
      </main>

      <nav
        aria-label={t('nav.primaryLandmark')}
        className="sticky bottom-0 grid grid-cols-5 items-end border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <BottomLink to="/inbox" label={t('domain.inbox')} icon={Inbox} />
        <BottomLink to="/next" label={t('domain.status.next')} icon={ListTodo} />

        {/* Capture — the headline action, front and center. */}
        <div className="flex justify-center">
          <button
            type="button"
            aria-label={t('nav.capture')}
            onClick={openCapture}
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        <BottomLink to="/focus" label={t('domain.focus')} icon={Target} iconClassName="focus-glow" />

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="h-5 w-5" />
          {t('nav.more')}
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('nav.more')}</SheetTitle>
            <SheetDescription>{t('nav.moreDesc')}</SheetDescription>
          </SheetHeader>

          <nav aria-label={t('nav.moreLandmark')} className="mt-4 flex flex-col gap-4">
            {MORE_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  {group.label ? t(group.label) : null}
                </span>
                {group.items.map(({ to, label, icon: Icon, hint }) => (
                  <NavLink
                    key={to}
                    to={to}
                    aria-label={t(label)}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors',
                        isActive ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent',
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium leading-tight">{t(label)}</span>
                      {hint && <span className="truncate text-xs text-muted-foreground">{t(hint)}</span>}
                    </span>
                  </NavLink>
                ))}
              </div>
            ))}
            <MoreBookmarks onNavigate={() => setMoreOpen(false)} />
          </nav>

          <NavLink
            to="/account"
            onClick={() => setMoreOpen(false)}
            className="mt-1 flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            <User className="h-4 w-4" />
            {t('nav.account')}
          </NavLink>
          <NavLink
            to="/account?tab=preferences"
            onClick={() => setMoreOpen(false)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            <Settings className="h-4 w-4" />
            {t('nav.settings')}
          </NavLink>
          <NavLink
            to="/help"
            onClick={() => setMoreOpen(false)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            <HelpCircle className="h-4 w-4" />
            {t('nav.help')}
          </NavLink>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              {t('nav.signOut')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** The Bookmarks group in the More sheet — only when there are any (BookmarkBar self-hides too). */
function MoreBookmarks({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const { document } = useWorkspaceContext();
  if (!document || bookmarksOf(document).length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {t('nav.bookmarks')}
      </span>
      <BookmarkBar onNavigate={onNavigate} />
    </div>
  );
}

function BottomLink({
  to,
  label,
  icon: Icon,
  iconClassName,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  iconClassName?: string;
}) {
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
      <Icon className={cn('h-5 w-5', iconClassName)} />
      {label}
    </NavLink>
  );
}
