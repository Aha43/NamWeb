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
  if (ws.noRemote) return <Centered>No workspace yet — sync from the desktop app first.</Centered>;
  return <Outlet />;
}

function Centered({ children }: { children: ReactNode }) {
  return <section className="mx-auto max-w-md py-8 text-center text-sm text-muted-foreground">{children}</section>;
}
