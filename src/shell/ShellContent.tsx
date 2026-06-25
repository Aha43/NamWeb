import { Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useWorkspaceContext } from '@/store/workspace-context';

/** Global workspace states (loading / error / no-remote) or the routed surface. */
export function ShellContent() {
  const ws = useWorkspaceContext();

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
  return <Outlet />;
}

function Centered({ children }: { children: ReactNode }) {
  return <section className="mx-auto max-w-md py-8 text-center text-sm text-muted-foreground">{children}</section>;
}
