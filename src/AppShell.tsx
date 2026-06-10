import { useState } from 'react';
import { inboxItems, nextActions } from './domain/lenses';
import { newId, nowIso } from './lib/local';
import { InboxPanel } from './features/inbox/InboxPanel';
import { NextActionsPanel } from './features/next-actions/NextActionsPanel';
import { toActionRow } from './features/actions/rows';
import type { UseWorkspace } from './store/useWorkspace';

type Tab = 'inbox' | 'next' | 'backlog';

const TABS: { id: Tab; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'next', label: 'Next' },
  { id: 'backlog', label: 'Backlog' },
];

/** Authenticated app shell: header, sync notice, active panel, and bottom nav. */
export function AppShell({ workspace, onSignOut }: { workspace: UseWorkspace; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('inbox');
  const { document, dispatch } = workspace;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">NamWeb</h1>
        <button
          type="button"
          onClick={onSignOut}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          Sign out
        </button>
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
          <Centered>{workspace.error}</Centered>
        ) : workspace.noRemote ? (
          <Centered>No workspace yet — sync from the desktop app first.</Centered>
        ) : tab === 'inbox' ? (
          <InboxPanel
            items={document ? inboxItems(document) : []}
            onAdd={(title) => dispatch({ type: 'addInboxItem', id: newId(), title, now: nowIso() })}
            onConvert={(id) => dispatch({ type: 'convertInboxToNext', id, now: nowIso() })}
            onDelete={(id) => dispatch({ type: 'deleteLeaf', id })}
          />
        ) : tab === 'next' ? (
          <NextActionsPanel
            rows={document ? nextActions(document).map((n) => toActionRow(document, n)) : []}
            onMarkDone={(id) => dispatch({ type: 'setStatus', id, status: 'DONE', now: nowIso() })}
            onMarkBacklog={(id) => dispatch({ type: 'setStatus', id, status: 'BACKLOG', now: nowIso() })}
          />
        ) : (
          <Centered>{TABS.find((t) => t.id === tab)!.label} — coming soon.</Centered>
        )}
      </main>

      <nav
        className="sticky bottom-0 grid grid-cols-3 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={
              'py-3 text-sm font-medium transition-colors ' +
              (tab === id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800')
            }
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-md py-8 text-center text-sm text-slate-500">{children}</section>;
}
