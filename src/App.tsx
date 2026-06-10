import { useState } from 'react';

type Tab = 'inbox' | 'next' | 'backlog';

const TABS: { id: Tab; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'next', label: 'Next' },
  { id: 'backlog', label: 'Backlog' },
];

/**
 * App shell for the NamWeb MVP. Mobile-first layout with a bottom nav.
 * Panels are placeholders until the feature issues (#6–#8) land.
 */
export default function App() {
  const [tab, setTab] = useState<Tab>('inbox');

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">NamWeb</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <Placeholder tab={tab} />
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

function Placeholder({ tab }: { tab: Tab }) {
  const label = TABS.find((t) => t.id === tab)!.label;
  return (
    <section className="mx-auto max-w-md text-center text-slate-500">
      <p className="text-sm">
        <span className="font-medium text-slate-700">{label}</span> — coming soon.
      </p>
    </section>
  );
}
