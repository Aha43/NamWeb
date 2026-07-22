import { Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SURFACES } from './nav';
import { useWorkspaceContext } from '@/store/workspace-context';

/** Global workspace states (loading / error / no-remote) or the routed surface. */
export function ShellContent() {
  const ws = useWorkspaceContext();
  const { t } = useTranslation();
  const { pathname } = useLocation();

  if (ws.loading) return <Centered>Loading…</Centered>;
  if (ws.error) {
    return (
      <Centered>
        <p>{ws.error}</p>
        <Button className="mt-3" onClick={ws.retry}>
          Retry
        </Button>
      </Centered>
    );
  }
  if (ws.noRemote) {
    return (
      <Centered>
        <p className="text-foreground">Welcome to NAM 👋</p>
        <p className="mt-1">Start a fresh workspace — it takes a second.</p>
        <Button className="mt-4" onClick={ws.createWorkspace} disabled={ws.creating}>
          {ws.creating ? 'Creating…' : 'Create workspace'}
        </Button>
        {/* Don't strand desktop-first users: their data appears here once the desktop app has
            pushed to the cloud — they just need to wait/re-check, not create a fresh (empty) one. */}
        <p className="mt-6 border-t border-border pt-4 text-xs">
          Already use NAM on the desktop? Your work shows up here once the desktop app has synced to
          the cloud — make sure you're signed in with the same account, then check again.
        </p>
        <Button variant="outline" size="sm" className="mt-2" onClick={ws.retry} disabled={ws.creating}>
          Check again
        </Button>
      </Centered>
    );
  }
  // A subtle "you are here" label (#869): the list surfaces look alike and you often land on one as a
  // side-effect of navigation. Matched by EXACT path, so a specific project (`/projects/:id`, which
  // shows its own title) and non-surface routes (account/help) stay unlabelled; Focus is outside the
  // shell entirely.
  const surface = SURFACES.find((s) => s.to === pathname);
  const Icon = surface?.icon;
  return (
    <>
      {surface && Icon && (
        <div className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {t(surface.label)}
        </div>
      )}
      <Outlet />
    </>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <section className="mx-auto max-w-md py-8 text-center text-sm text-muted-foreground">{children}</section>;
}
