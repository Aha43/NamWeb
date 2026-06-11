# Changelog

All notable changes to NamWeb are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- Project Workbench (`/projects/:id`): drill into a project — a clickable breadcrumb of ancestors,
  the project's own actions (full row parity: status menu, edit, inline rename), its sub-project
  sections (open to drill in), and quick-adds for an action or a sub-project. New `addAction`
  mutation; action rows now carry their status. Closes #45.
- Projects surface: a new `/projects` route (and **Projects** nav entry in both shells) listing
  top-level projects with their tags, a quick-add to create one (`addSubProject`), and open-into
  the workbench. Closes #44.
- Project hierarchy mutations (`src/domain/mutations.ts`): `addSubProject`, `moveNode` (reparent,
  with self/cycle/structural guards), `convertActionToProject` (lifts a free action to a top-level
  project), `convertProjectToAction` (leaf projects only), and `deleteRecursive` (subtree delete,
  sweeping `blockedBy` references). Pure, replayable, tested. Closes #43.
- Project hierarchy lenses (`src/domain/lenses.ts`): `projects` (top-level projects), `buildPath`
  (ancestor project chain for breadcrumbs; `projectPath` is now its string form), and
  `effectiveTags` (own + inherited ancestor-project tags). Pure, no UI — foundation for the
  Projects list and Workbench. Closes #42.

### Changed

- Due dates now match NamDesktop: the Action dialog accepts **flexible date entry** (`26-7-4`,
  `2026/6/15`, separators `- / .`, 2-digit year → `20YY`) via a ported `parseFlexibleDate`, with an
  inline error on bad input; and list rows show a compact, urgency-coloured hint (overdue / Today /
  `Nd` / short date) instead of the raw ISO string. New tested `src/lib/dates.ts`. Closes #31.
- UI now uses the full product name **Next Action Master** (via a single `APP_NAME` constant)
  instead of the internal "NamWeb" — on the login card, both shell headers, the logo's accessible
  name, and the document title. Repo/package identifiers stay "NamWeb". Closes #30.

- Interaction & a11y polish: the focus deck is **code-split** — framer-motion now loads on demand
  with the `/focus` route instead of in the initial bundle (clears the chunk-size warning; main
  bundle drops below 500 kB). The deck respects `prefers-reduced-motion` and announces its progress
  via `aria-live`. Closes #22.
- Restyled all existing surfaces onto the design system: Inbox, Next Actions, Backlog, `ActionRow`,
  Login, and the not-found / loading states moved from hardcoded `slate-*` classes to the dark-aware
  design tokens (`bg-card` / `text-foreground` / `text-muted-foreground` / `border-border` /
  `text-primary` / `text-destructive`), with the shadcn `Button` for primary actions. The app is now
  fully dark-mode-correct end to end. Closes #21.

### Added

- Inline status switch: each Next/Backlog row has a status badge (N/B/D) that opens a menu to set
  Next / Backlog / Done (replacing the ad-hoc per-row buttons), mirroring NamDesktop's clickable
  badge. Adds a shadcn `dropdown-menu` primitive (`@radix-ui/react-dropdown-menu`). Closes #37.
- FIFO/LIFO sort toggle on Next & Backlog: a toolbar control cycles unsorted → oldest-first →
  newest-first (by `createdAt`), persisted per-list in localStorage. Mirrors NamDesktop's clock
  toggle. Closes #38.
- Inline title rename: double-click a row's title (Inbox / Next / Backlog) to edit it in place —
  Enter commits via `updateNode` (preserving description), Esc or blur cancels. Shared
  `InlineRename` component. Closes #35.
- Relative age hint on rows: Inbox / Next / Backlog rows now show a compact age (`3d`, `2w`, `4m`,
  `1y`) from `updatedAt`/`createdAt`, amber once older than a week — mirroring NamDesktop's Age
  column. New `formatAge` in `src/lib/dates.ts`. Closes #36.
- Inbox Process dialog: an item can now be clarified — **one action** vs **needs planning (project)**,
  and for an action **do it next** vs **park for later (backlog)** — via a two-step dialog opened
  from the inbox row's "Process…" action (replaces the bare "→ Next"). New `convertInboxToAction`
  and `convertInboxToProject` mutations. Mirrors NamDesktop's ProcessInboxDialog. Closes #34.
- Configurable workspace identity: the synced workspace row is no longer hardcoded to `default` —
  it reads `VITE_WORKSPACE_NAME` (defaulting to `default`), matching NamDesktop's normal-mode
  (`default`) vs dev-mode (`dev`) naming so the web client can point at the right row (e.g. `dev`
  for local testing). Closes #27.
- Dev workspace switcher: a runtime workspace-name resolver (`src/lib/workspace.ts`, localStorage
  over the env default) plus a dev-builds-only "Use dev workspace" checkbox on the login screen
  that points the session at the `dev` row — so a developer can see NamDesktop dev-mode data
  without a rebuild. Seed of a future user-facing "Play" sandbox. Closes #28.
- Edit an action after capture: a reusable **Action dialog** (title, description, tags, due date,
  and status radios) opened from a pencil button on every Inbox / Next / Backlog row via an
  app-wide `ActionEditorProvider` (`useActionEditor().openEditor(id)`, mirroring the capture
  provider). Backed by new pure, replayable mutations — `updateNode`, `setDue`, `updateTags`
  (with tag normalization) — dispatched only for fields that actually changed, so edits replay
  through the conflict-retry commit. Closes #26.
- Form & dialog UI primitives: `Input`, `Textarea`, `Label`, and a shadcn `Dialog` (on the
  already-present `@radix-ui/react-dialog`) added to `src/components/ui`, styled on the design
  tokens and matching the existing `Button`/`Sheet` conventions. Primitives only — they unblock
  the Action edit dialog and later form-driven surfaces. Closes #25.
- Brand logo on the login screen: the NamWeb mark (ported from NamDesktop's `logo-mark.svg`,
  inlined as a `currentColor`-driven `LogoMark` component so it tracks the theme) now sits above
  the heading on the login card, dark-mode aware and with an accessible name. Closes #24.
- Focus execution deck — the centerpiece. An immersive full-screen `/focus` surface (outside the
  shell chrome, mirroring how desktop focus mode hides the toolbar) modeled on NamDesktop focus
  mode: one card at a time (project path, title, description) with an `N / total` counter, Done &
  advance (`setStatus DONE`), circular prev/next, and an all-done state. Keyboard (←/→/Space/Esc) and
  swipe (framer-motion) navigation, plus a Next/Backlog source toggle. Replaces the placeholder.
  Closes #20.
- Capture surface: an always-available quick-capture sheet (`CaptureProvider` + `CaptureSheet`)
  opened from anywhere via `useCapture().openCapture()` — both the phone center Capture button and
  the desktop sidebar Capture button now open it (no longer routing to Inbox). Stays open for rapid
  multi-capture, dispatches `addInboxItem`, and adapts its side (bottom on phone, right on desktop).
  Closes #19.
- Adaptive shell — the architectural spine. The form-factor split is now **IA, not just CSS**: a
  `useIsDesktop` breakpoint switches between a `DesktopShell` (persistent sidebar listing every
  surface, parity-ready) and a `PhoneShell` that pushes **capture + execution to the front** — a
  center Capture button and a Focus action in the bottom bar, with Backlog and the rest behind a
  **More** sheet. Shared `ShellContent` / `SyncNotice`; shadcn `Sheet` primitive added; shells
  styled on the dark-aware design tokens. Tests mock `matchMedia` for both form factors. Closes #18.
- Routing (React Router): real, deep-linkable routes — `/inbox`, `/next`, `/backlog`, `/focus`
  (placeholder), an index redirect to `/inbox`, and a not-found. The `useState` tab is gone; the
  shell is now a route layout (`AppShell` + `Outlet`, `NavLink` nav). Workspace state moved behind a
  `WorkspaceProvider` / `useWorkspaceContext` so the route pages (and both shells coming in #18)
  share one instance; surfaces split into page containers under `src/routes/`. Tests run against a
  deterministic Supabase test env. Closes #17.
- Design-system & theming foundation: shadcn/ui (Radix + Tailwind) wired up — `cn` util, `@`→`src`
  path alias, Tailwind theme tokens via CSS variables, `tailwindcss-animate`, `lucide-react`, a
  `Button` primitive, and a dark-mode `ThemeProvider`/`ThemeToggle` (default dark to echo the
  desktop, no-FOUC inline script, persisted to localStorage). Surface restyle comes later. Closes #16.
- Conflict + empty/error polish: the sync notice now auto-dismisses after ~4s (still manually
  dismissible), and a failed initial load shows the error with a Retry button that re-runs the pull
  (`useWorkspace` gains `retry`). Rounds out the empty/no-remote/error states across the app.
  Closes #9.
- Backlog UI: the `backlog` tab renders the `backlogItems` lens (reusing the shared `ActionRow`)
  with a single promote-to-Next action (→ `setStatus NEXT`). All three MVP tabs are now functional.
  2 tests. Closes #8.
- Next Actions UI: the `next` tab renders the `nextActions` lens with project path, tags, and a due
  hint, and mark-done / send-to-backlog actions (→ `setStatus`). New `projectPath` lens helper
  (ancestor project titles, structural containers excluded) and a shared `ActionRow`/`ActionList`
  presentation plus `toActionRow` mapper (reused by Backlog next). 6 tests (panel + projectPath).
  Closes #7.
- `make dev` one-command launcher (`makefile` + `scripts/dev-up.ps1`): ensures npm deps and `.env`
  are present, checks whether the local Supabase stack is up on `127.0.0.1:54321` and starts it from
  the sibling NamDesktop repo if not (waiting until ready), then runs `npm run dev`. Cross-platform
  PowerShell (TcpClient port probe, no Windows-only cmdlets). Thin `make run/test/build/lint/install`
  passthroughs too. Closes #10.
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
