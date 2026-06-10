# Changelog

All notable changes to NamWeb are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- Inbox UI: the workspace now runs end-to-end. `AppShell` consumes the `useWorkspace` hook (wired
  via a new `AuthedApp`), renders the inbox via the `inboxItems` lens, and shows loading / no-remote
  / dismissible sync-notice states. New `InboxPanel` (`src/features/inbox/`) provides quick-add
  capture (the headline flow → `addInboxItem`), convert-to-Next, and delete, with an Inbox-zero
  empty state. `src/lib/local.ts` supplies node ids and Java-`LocalDateTime`-compatible timestamps.
  11 tests (InboxPanel + AppShell states). Closes #6.
- Workspace store + mutations: intent-based pure mutations (`src/domain/mutations.ts` —
  `addInboxItem`, `convertInboxToNext`, `setStatus`, `deleteLeaf`, each replayable), the optimistic
  single-flight commit with intent-replay conflict-retry (`src/store/commit.ts` — push guarded;
  on conflict pull, re-apply the same intent, push once more; bounded give-up that surfaces a
  "reloaded" notice; handles vanished node / vanished row), and the `useWorkspace` hook
  (`src/store/useWorkspace.ts`) that loads the `default` row, holds the snapshot, and serializes
  dispatched intents. 15 unit tests on the pure core (mutations + every commit branch). No UI yet.
  Closes #5.
- Auth + session: Supabase client (`src/lib/supabase.ts`) from `.env` vars, a `useSession` hook
  tracking sign-in/sign-out, and an email/password `Login` form with error states. The app is gated
  behind login — `App` shows `Login` until there's a session, then the `AppShell` (now with a Sign
  out button). Shell extracted from `App` into `AppShell` for clean testing. 5 tests (login submit +
  error, shell tabs + sign-out). Closes #4.
- Workspace sync client (`src/sync/workspaceClient.ts`): `pull(name)` and `push(name, document,
  guardVersion)` over `@supabase/supabase-js`, mirroring the NamDesktop cloud-sync contract —
  version-guarded update, first-push insert, and conflict detection (guarded update matches zero
  rows → fetch to disambiguate first-push from a stale-version conflict). Typed `PullResult` /
  `PushResult`. 9 unit tests against a mocked Supabase client. No UI. Closes #3.
- Domain model + lenses (`src/domain/`): TypeScript mirror of the NamDesktop workspace document
  (`NamNode`, `NodeStatus`, `WorkspaceDocument`, with field names matching the Jackson JSON blob)
  and pure lens selectors ported verbatim from the Java lenses — `inboxItems` (inbox children, any
  status), `nextActions` (NEXT, non-project, non-structural), `backlogItems` (BACKLOG, non-project,
  not an inbox item), plus `structuralNodeIds`/`buildParentIndex` helpers. 15 unit tests. No UI.
  Closes #2.
- App scaffold: Vite + React + TypeScript SPA with Tailwind CSS, `@supabase/supabase-js`, and
  TanStack Query. Mobile-first app shell with a bottom nav (Inbox / Next / Backlog placeholders),
  `.env.example` defaulting to the local Supabase stack, Vitest + Testing Library setup with a
  shell smoke test, ESLint flat config, and `npm run dev/build/test/lint/typecheck` scripts.
  Stack decided in the first planning session; the MVP talks directly to Supabase (no web API).
  Closes #1.
- Repository bootstrap: project conventions (`CLAUDE.md`, `README.md`, `LICENSE`, `.gitignore`,
  `VERSION`), GitHub issue templates, and the web-app design thread carried over from NamDesktop
  (`docs/features/web-app/design.md`). No application code yet — the frontend stack and first
  epics are decided in a planning session.
