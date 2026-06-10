import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ThemeToggle } from './components/theme/ThemeToggle';
import { useWorkspaceContext } from './store/workspace-context';

const NAV = [
  { to: '/inbox', label: 'Inbox' },
  { to: '/next', label: 'Next' },
  { to: '/backlog', label: 'Backlog' },
];

/** Route layout: header, sync notice, global workspace states, routed content, bottom nav. */
export function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const workspace = useWorkspaceContext();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">NamWeb</h1>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={onSignOut}
            className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            Sign out
          </button>
        </div>
      </header>

      {workspace.notice && (
        <div role="status" className="flex items-center justify-between bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>{workspace.notice}</span>
          <button type="button" onClick={workspace.clearNotice} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 py-6">
        {workspace.loading ? (
          <Centered>Loading…</Centered>
        ) : workspace.error ? (
          <Centered>
            <p>{workspace.error}</p>
            <button
              type="button"
              onClick={workspace.retry}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Retry
            </button>
          </Centered>
        ) : workspace.noRemote ? (
          <Centered>No workspace yet — sync from the desktop app first.</Centered>
        ) : (
          <Outlet />
        )}
      </main>

      <nav
        className="sticky bottom-0 grid grid-cols-3 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              'py-3 text-center text-sm font-medium transition-colors ' +
              (isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <section className="mx-auto max-w-md py-8 text-center text-sm text-slate-500">{children}</section>;
}
