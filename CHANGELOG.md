# Changelog

All notable changes to NamWeb are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- Remote MCP server — **P0 read-only prototype**. A standalone `mcp/` server (`npm run mcp`, run via
  `tsx`, not bundled by Vite) exposes the Nam workspace over MCP (Streamable HTTP at `POST /mcp`) so the
  ChatGPT / Claude web surfaces can read it. It reuses the React-free core directly — `pull()` over the
  Supabase `workspaces` row plus the `domain/lenses` projections — behind ten desktop-parity read tools
  (`get_workspace_context`, `list_inbox`, `list_projects`, `list_next_actions`, `list_backlog`,
  `list_done`, `list_saved_views`, `list_project_children`, `find_node`, `list_resources`). No auth and
  no writes yet (later phases: P1 OAuth, P2 writes, P3 Realtime, P4 hosting). Design doc at
  `docs/features/remote-mcp/design.md`; usage in `mcp/README.md`. Closes #105.
- The brand `LogoMark` now appears next to the **Next Action Master** wordmark in the desktop sidebar
  header and the phone header, and a `favicon.svg` (mirroring the logo, light/dark-adaptive via
  `prefers-color-scheme`) is shown in the browser tab. Closes #101.

### Changed

- Wider desktop workspace: the surface panels (Inbox, Next, Backlog, Due, Blocked, Tags, Search, Projects,
  Done, Templates, Goals, and the project workbench) were double-capped — the shell limits content to
  `max-w-2xl` and each surface re-capped at `max-w-md` (~448px), leaving large left/right margins on desktop.
  The shell + per-surface caps are now `max-w-4xl` (~896px), so content fills much more of the screen.
  Short centered messages and the Focus deck keep their narrower widths; phone is unaffected. Closes #99.

### Fixed

- The Action edit dialog (and any tall dialog) no longer overflows small/phone screens: the shared
  `DialogContent` is now capped to the viewport (`max-h-[calc(100dvh-2rem)]`) and scrolls internally,
  so the footer (Save/Cancel) stays reachable instead of being clipped off-screen. Guarded by a
  phone-viewport E2E regression. Closes #74.

### Added

- Collapsible **Actions** and **Sub-projects** sections in the workbench **List** and **Heat-map** views:
  each section now has a header (chevron + count) that collapses its body — matching the per-column collapse
  in Column view. Collapsed state is persisted per-project (localStorage, via `useCollapsedSections`);
  defaults to expanded. Closes #98.
- Collapsible **Add to project** panel on the workbench: the add controls (Add action, Add sub-project,
  Add from template, Save as template…) are now grouped in a panel with a header toggle, so they can be
  tucked away on busy projects to free vertical space. Collapsed state is persisted per-project
  (localStorage, via `useCollapsedAddPanel`); defaults to expanded. Closes #97.
- Top toolbar strip on desktop: a full-width toolbar now carries the sidebar collapse/expand toggle and a
  **live search box** on the left, and the **theme toggle + Sign out** on the right — moved out of the
  sidebar. The toolbar search drives the Search surface via a `?q=` URL param (results update live) and
  persists across routes, so it keeps focus while you type. Search is removed from the desktop sidebar nav
  (still in the phone More sheet). `PhoneShell` is unchanged. Closes #96.
- Resizable + collapsible desktop sidebar: the divider between the view list and the workspace can be
  **dragged** to set the sidebar width (persisted to localStorage, clamped 180–480px; double-click resets,
  arrow keys nudge for keyboard a11y), and the view list can be **collapsed** entirely via a toggle — a
  small floating expand button restores it, maximizing workspace width. Desktop-only. Closes #95.
- Reorder Kanban columns (Workspace parity): each sub-project column in the **Column** view gains
  **left/right** move buttons, so the columns can be rearranged without drag. The **Unsorted** column
  stays fixed first; moving a column reorders the project's sub-projects (the same `reorderChildren`
  the List view's up/down buttons use). Unit + desktop E2E coverage. Closes #93.
- Column drag-and-drop (Workspace parity, phase 6b): in the workbench **Column/Kanban** view (desktop)
  you can now **drag actions within a column** to reorder them and **between columns** to reparent them
  — including into an empty column — landing at the drop position. Reuses the existing `reorderChildren`
  / `moveNode` intents (a cross-column drop runs `moveNode` then `reorderChildren`, computed from the
  deterministic post-move `childIds`). The within-column up/down buttons and the editor's **Move to…**
  stay as fallbacks. New `resolveColumnDrop` helper + multi-container dnd-kit wiring in `ColumnView`.
  Unit + desktop E2E coverage. Closes #91.
- Drag-and-drop reorder (Workspace parity, phase 6a): on desktop you can now **drag** rows by a grip
  handle to reorder them — the Next & Backlog lists (in "Unsorted" mode) and the workbench List view's
  direct actions and sub-projects. Reuses the existing `reorderView` / `reorderChildren` intents (a
  new `reorderKindWithinChildren` lens splices one kind's new order back into the parent's `childIds`,
  leaving the other kind in place). The up/down buttons stay as an a11y fallback and remain the only
  control on phones; drag is skipped for single-item lists. New `SortableList` / `SortableRow` /
  `ReorderableActionList` components (dnd-kit). Unit + desktop E2E coverage. Closes #89.
- Resources on actions & projects (Workspace parity, phase 5): the editor dialog gains a **Resources**
  section to attach links/notes (type — URI/EMAIL/FILE/TEXT — + value) and remove them, and rows show a
  **paperclip** when a node has resources. New `updateResources` intent (node-generic, replay-safe);
  `ActionRowData` carries `hasResources`. FILE is link/metadata only (no upload). Unit + desktop E2E
  coverage. Closes #87.
- Collapsible workbench columns (Workspace parity, phase 4): in the Column view each column has a
  collapse toggle (→ a narrow strip showing its title + count); the set of collapsed columns is
  **persisted per-project** in localStorage (mirroring desktop), so it survives reloads. New
  `useCollapsedColumns` hook; desktop E2E journey. Advances #64; closes #85.
- Workbench delete & project editing (Workspace parity, phase 3): the editor dialog gains a **Delete**
  button (confirms with the subtree size, then `deleteLeaf` or `deleteRecursive`), and now opens for
  **project** nodes too (title/description/tags/due/status, relabelled "Edit project"; action-only
  bits stay hidden). Sub-project rows in the workbench gain an **edit** affordance. Unit + desktop E2E
  coverage. Closes #83.
- Workbench Column/Kanban view (Workspace parity, phase 2): the project workbench gains a
  **List / Heat-map / Column** view switch (persisted per-project). **Column** mode (desktop-only)
  shows a leading **Unsorted** column for the project's own actions plus one column per sub-project,
  each with status menu, inline rename, **within-column up/down reorder** (via `reorderChildren`), and
  a per-column quick-add; cross-column moves reuse the editor's **Move to…**. New `ColumnView` +
  `useViewMode` hook. Desktop E2E journey. Advances #64; closes #81. (Drag-and-drop reparent/reorder,
  lanes, and collapse land in later phases.)
- Workbench reorder (Workspace parity, phase 1): a project's direct **actions** and its **sub-projects**
  can now be hand-ordered with up/down controls in the workbench. Unlike the Next/Backlog reorder (which
  uses `viewOrders`), this rewrites the parent's **`childIds`** — the structural order shared with
  NamDesktop, so the order shows up there too. New `reorderChildren` intent and `projectActions` /
  `subProjects` lenses (pure, tested), plus a desktop E2E journey. Closes #79.
- Manual reorder on the Next & Backlog lists: in **Unsorted** mode each row gets up/down controls to
  hand-order actions; the order persists in the synced workspace document (`viewOrders`, mirroring
  NamDesktop) and survives across devices. A pure `applyViewOrder` lens reconciles the saved order
  with live items (new ones appended, vanished ids dropped); a `reorderView` intent stores it. The
  Oldest/Newest sort modes stay computed (no manual controls). Tested (unit + a phone/desktop E2E
  journey). Closes #39.
- E2E mocked journeys — round two (Playwright): broadens the network-mocked suite to close out the
  testing base. **Triage breadth** (backlog status switch, due-date grouping, the blocked surface,
  and reshaping actions ↔ projects: Make project / Move to… / Convert to action); **Mission Control
  + templates** (create a Goal Board → station heat-map → drill, and the save-as-template /
  apply-template round-trip); and **error / conflict / empty states** — the REST mock gains
  `failFirstGet` (drives the load-error + Retry path) and `alwaysConflict` (forces a push conflict
  so the dismissible "Reloaded" sync notice surfaces). Closes #72.
- E2E network-mocked journeys (Playwright): a backend-free journey suite that intercepts the
  Supabase auth + REST calls (`page.route`, `e2e/mocks/`) and seeds an in-memory workspace
  document, so it runs fast and deterministically across a **desktop and a phone** viewport
  (iPhone 13). A reusable `mockedTest` fixture auto-installs the mocks and a `DocBuilder` seeds
  state per spec. First journeys: phone capture/focus/More navigation, projects workbench
  (create → drill → add → breadcrumb), tag filter + saved view, search, and a nav + dark-mode
  guardrail. Wired into CI as a PR gate (the real-Supabase smoke stays local). Closes #61.
- E2E scaffold (Playwright): a `playwright.config.ts` that boots Vite on a dedicated port against
  an isolated `e2e` workspace, signs in once (setup project → `storageState`), and runs a
  happy-path smoke (capture → process → Next → mark done) in **Chromium and WebKit** (the iOS
  Safari proxy) against the real local Supabase. Each browser project drives its own freshly
  seeded workspace row for full isolation. New `npm run e2e` / `e2e:ui` scripts. Closes #60.
- Apply template: an "Add from template…" picker in the project workbench instantiates a saved
  template's structure under the current project. The clone's fresh node ids are generated in the
  page and carried in the new `applyTemplate` intent, keeping it pure and replayable. Closes #68.
- Templates (save & manage): "Save as template…" in a project workbench captures its subtree as a
  reusable template (`saveAsTemplate`), and a new `/templates` route (and **Templates** nav entry)
  lists templates with item counts and delete (`deleteTemplate`). Closes #67.
- Goal Boards surface: a new `/goals` route (and **Goals** nav entry) — create tag-grouped Goal
  Boards (name + tags), open one to a heat-map of matching projects (done-ratio cards that drill
  into the workbench), and delete boards. Closes #66.
- Goal Board foundation: a `missionControlStations` lens (projects matching any of a board's tags,
  de-duped to the top-most, with done-ratio roll-ups via a shared `projectRollup`) and
  `createMissionControl` / `deleteMissionControl` mutations. Pure, tested. Closes #65.
- Search surface: a new `/search` route (and **Search** nav entry) — a query box searching titles
  and tags (case-insensitive, excludes done), with results tagged Action / Project and their
  project path; opening an action edits it, opening a project drills into its workbench. Closes #58.
- Saved Views: save the current tag filter as a named view and open / rename / delete saved views
  from `/tags`, plus a **Next only** toggle so views round-trip fully. New `createSavedView` /
  `renameSavedView` / `deleteSavedView` mutations over `doc.savedViews`. Closes #57.
- Tag-filter surface: a new `/tags` route (and **Tags** nav entry) to filter active actions by
  tags (AND) via toggle chips, with a live match count and the inline status menu / edit / rename.
  Closes #56.
- Tag & search selectors (`src/domain/lenses.ts`): `allTags`, `contextItems` (AND-match over
  effective own+inherited tags, optional NEXT-only), and `searchResults` (case-insensitive
  title/tag search). Pure foundation for the tag-filter and search surfaces. Closes #55.
- Blockers in the Action dialog: a **Blocked by** section to add prerequisites (a cycle-safe
  candidate picker) and remove them, plus a **Would unblock: …** hint — dispatched live via the
  editor provider. Closes #53.
- Blocked surface: a new `/blocked` route (and **Blocked** nav entry) listing actions awaiting
  prerequisites, grouped under each active blocker (the header opens that blocker). Closes #52.
- Prerequisites foundation: `addPrerequisite` / `removePrerequisite` mutations (cycle-safe via
  `canAddPrerequisite`) and `isBlocked` / `blockedGroups` / `unblocks` selectors — the
  dependency-graph core behind the Blocked surface and the dialog's blockers section. Closes #51.
- Due surface: a new `/due` route (and **Due** nav entry) grouping non-done actions with due dates
  by urgency — Overdue / Today / This week / Later (empty sections hidden) — with the inline status
  menu, edit, and rename. New `dueGroups` lens. Closes #50.
- Done surface: a new `/done` route (and **Done** nav entry) listing completed actions with
  restore-to-Next, move-to-Backlog, and delete. New `doneItems` lens. Closes #49.

- Workbench heat-map: a project with sub-projects can toggle its sub-project section to a heat-map
  of cards — each showing done/total and a done-ratio-coloured border (red/amber/green) — that drill
  in on click. New `missionStats` roll-up. Mirrors NamDesktop's MCR mode. Closes #47.
- Reshape items between actions and projects: the Action dialog gains **Make project** (lift an
  action to a project) and **Move to…** (reparent to another project or Free actions, excluding the
  item's own subtree); a leaf project's workbench offers **Convert to action**. Wires the
  `convertActionToProject` / `moveNode` / `convertProjectToAction` mutations. Closes #46.
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

- The Action dialog's **Due field now echoes a canonical date** on blur: relaxed entry like `26-7-4`
  normalizes to the zero-padded ISO form `2026-07-04`, confirming exactly what was parsed (invalid
  text is left untouched until save). The configurable date-format *setting* from #32 is deferred to
  the Settings surface. Closes #32.
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
