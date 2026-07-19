# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always present a plan and wait for explicit approval before editing any files or running commands.

## What this repo is

NamWeb **is NAM** — the primary (and only active) surface of a GTD-inspired capture, triage,
and focus system: full workbench, projects, tags/contexts, calendar, Focus decks, bookmarks,
sync. It started life as the web companion to
[NamDesktop](https://github.com/Aha43/NamDesktop) and has long since outgrown that role.

See `docs/features/web-app/design.md` for the product direction and the dependency chain that
led here. The next epic: **project sharing** (projects rendered as guest-friendly web sites via
secret URLs — guests never become users) is the road to **2.0.0**.

## NamDesktop (parked) and the backend

- **NamDesktop is parked** (since 2026-07-12) — the valuable phase one (it proved the
  chat→"make it in NAM"→execute MCP flow). It is not being caught up; a future desktop app
  will be *redone* using NamDesktop and the-then-NamWeb as inspiration and specification.
- The **Supabase config + migrations live in this repo** (`supabase/`, the single source of
  truth) — `npm run db:start` runs the local stack (Docker Desktop required).
- The **workspace document format** (one JSONB doc per workspace) is no longer a two-client
  contract, but it remains a **spec-in-progress** for the future desktop redo: keep the
  additive-only / absent-key-means-off discipline, and write contract-relevant changes down.
  Known divergences a revival must absorb BEFORE syncing: the `COUNT` (#799) and `QUESTION`
  (#827) resource types — NamDesktop's Java `ResourceType` enum would throw on deserialize;
  extend the enum first, same rigidity that forced #658's `nam://` links to hide inside `URI`.
  Also (#837): **system tags now use a reserved `#` sigil** (`#in-progress`, `#shared-hide`,
  `#shared-show`, `#shared-open`) — the web writes the sigiled forms and read-aliases the one
  legacy spelling still on live docs (`in progress` → `#in-progress`); `private` was renamed to
  `#shared-hide` with no alias. A revival must adopt the `#` namespace for system tags.

## Tech stack

Decided in the first planning session (see `docs/features/web-app/design.md`):

- **React + TypeScript** on **Vite** (mobile-first responsive SPA, online-only for the MVP).
- **`@supabase/supabase-js`** — talks **directly** to Supabase. No web API of our own; the
  web-API + relational schema is a deferred future epic.
- **TanStack Query** — server state, optimistic updates, the sync conflict-retry.
- **Tailwind CSS** — styling.
- **Vitest** + Testing Library — unit/component tests. **ESLint** (flat config) — lint.

## Build commands

```bash
npm install      # install dependencies (first time)
npm run dev      # start the Vite dev server (http://localhost:5173)
npm run build    # typecheck + production build to dist/
npm run test     # run the Vitest suite once
npm run lint     # eslint
npm run typecheck # tsc --noEmit
```

Copy `.env.example` to `.env` to configure the Supabase URL + publishable key. The defaults
target the local Supabase stack run from this repo (`npm run db:start`; `db:stop` / `db:status`
/ `db:reset` also exist).

## Environment & data

- **Seed / clean / reset of the local dev workspace is a safe test-data action — proceed without
  asking.** The local Supabase stack and the demo workspace hold disposable test data only. Pause
  to confirm first **only** if production data is plausibly involved.

## Workflow

- **Always work on a GitHub issue.** Never start implementation without a corresponding issue —
  either one created upfront or one we create together before coding begins.
  Include `Closes #<number>` in every non-chore commit.
- **Always check the current branch before committing.** If on `main`, warn and stop.
  All feature work must go on a feature branch. Confirm you're on the *intended* branch for
  this issue — not a leftover branch from earlier work; if it doesn't exist yet, create it
  from `main` first.
- **`main` is branch-protected** (since 2026-06-25): direct pushes are rejected — every change lands
  via a PR, the **`check`** CI job (lint + typecheck + test + build) must pass, and history is linear
  (squash-merge). No required reviews (solo-friendly: you can merge your own PR once `check` is green);
  admins can't bypass, so don't rely on direct-to-`main` pushes.
- **Default feature branch name is `feature/next`.** Rename it to something descriptive
  before opening a PR.
- **Re-run tests after multi-file changes, not only at delivery.** Changes touching React
  context/provider hooks (e.g. `useDeleteProject`) or e2e poll commands / URL aliases are the
  usual culprits for silent breakage — run `npm run test` after such edits (and the full
  `npm run e2e:mocked` before opening a PR, per Delivery).
- When completing a GitHub issue, update the `## [Unreleased]` section of `CHANGELOG.md`
  before committing. Use `Added`, `Changed`, or `Fixed` as appropriate, and include
  `Closes #<number>` in the commit message.
- **One issue at a time.** After completing an issue, stop and wait for the user to confirm
  before starting the next one — even when multiple issues are planned for the same sprint.
  (**Exception: auto-sprint mode** — see "Auto-sprints" below, where the whole agreed set runs
  straight through without per-issue pauses.)

### Delivery: ship a PR with a Cloudflare preview link

Once a feature is built and **locally green** (typecheck, lint, full unit suite, and the **full
mocked e2e suite** — `npm run e2e:mocked`, not just the journey you touched — all pass), **deliver
it for review automatically — do not pause to ask "want me to commit?":**

> **Run the whole mocked e2e suite, not just the relevant journey.** Use `npm run e2e:mocked`
> (mocked-desktop + mocked-phone — exactly what the nightly `e2e-mocked` job runs; network-mocked,
> so no Supabase needed). It's ~10s and it is the gate that stops cross-feature drift: a change can
> pass its own journey while silently breaking another (autosave removing a Save button, a new
> copy/undo-toast colliding with a selector, a reworded notice). The nightly is only a catch-all;
> `e2e-mocked` does **not** run per-PR, so local is the real gate. This applies to a **single issue
> and to each auto-sprint branch** before its PR. (`npm run e2e` additionally runs the real-Supabase
> smoke specs, which need the local stack up — not part of this gate.)

1. Commit (`Closes #<number>` + the standard co-author line).
2. Push the feature branch and open the PR.
3. Fetch the **Cloudflare Pages branch-preview URL** and post it. It lives in the PR's
   "Cloudflare Pages" check output — read it with
   `gh api repos/Aha43/NamWeb/commits/<sha>/check-runs --jq '.check_runs[] | select(.name=="Cloudflare Pages") | .output.summary'`
   and surface the `*.namweb.pages.dev` **Branch Preview URL** (it tracks the latest push; the
   per-commit hash URL is frozen to one build).
4. **Pause for the user to test on the preview.** Merge only when they explicitly say so
   (`gh pr merge <#> --squash --delete-branch`) — merge is the one step that still needs a go-ahead.

**Phrase the test steps for the preview around the demo.** Every preview carries the no-account
**"Try the demo"** path (sign-in screen, or `…/demo`) — a populated local workspace, no login (see
`docs/features/demo-workspace/design.md`). For **client-side** changes (UI + domain: lists, editor,
Focus, tags, projects, etc.) write the how-to-test as *"open **Try the demo** and …"* — fastest for
the user, disposable data, a Reset button, and it exercises the same code. Reserve "sign in and …"
for changes that genuinely need a real session: Supabase sync / conflict-retry / realtime, auth
(sign-up/verify/reset), the Account page (delete/export), or MCP — the demo can't exercise those.

The CF preview — not local `npm run dev` — is the default surface the user tests on.

### Auto-sprints

A way to run a batch of related work end-to-end. The shape:

1. **Plan the sprint.** Either chat through the issues, or the user dumps a markdown plan exported
   from NAM (its project-summary feature). Either way, converge on a concrete set of issues.
2. **Create the issues in GitHub** once agreed (e.g. 4 issues), each scoped to one deliverable.
3. **Work the whole set straight through, autonomously.** Do *not* pause for confirmation between
   issues (this is the exception to "one issue at a time"). Pause only for a **genuine blocker** or
   an **unresolved design decision** — otherwise keep going to the end.
4. **One issue → one independent branch off `main` → one PR.** Branches are independent (parallel,
   each independently mergeable), not stacked. If two issues genuinely conflict or depend on each
   other, flag it and sequence just those — don't silently stack everything.
5. Each PR follows the **Delivery** loop above: locally green (incl. the **full mocked e2e suite**,
   `npm run e2e:mocked`, on that branch — see Delivery) → commit → push → PR with **how to test** +
   the **Cloudflare branch-preview link**.
6. **Never merge during the sprint.** The deliverable is N PRs (each with test notes + a CF link)
   left open for the user. Merge only after they've tested — or explicitly said a PR can be merged.

### Definition of Done for feature issues

A feature issue is complete when:
- the feature works (verified by running it; for UI, on the Cloudflare PR preview)
- relevant tests are added or updated
- all existing tests pass — including the **full mocked e2e suite** (`npm run e2e:mocked`), not just
  the journey you touched; if your change broke another journey, update it before delivering
- no obvious domain invariant is weakened

### Releases

**Follow `docs/RELEASING.md` exactly when cutting a release** — don't improvise from memory:

- **Merging is not releasing.** Every merge deploys via Cloudflare; a *version* is a deliberate
  milestone. Cut a **minor** at the end of a sprint/batch (the default), a **patch** only for an
  off-cycle fix worth announcing.
- **A code review of the diff since `.codex-review` is a mandatory gate before any cut** — address
  the findings, then update `.codex-review` to the reviewed `main` HEAD.
- Then: release PR (`npm version X.Y.Z --no-git-tag-version` + CHANGELOG roll with summary line and
  link definitions) → squash-merge → annotated `vX.Y.Z` tag pushed → `release.yml` publishes the
  GitHub Release from the CHANGELOG section → report the **"footprint since last release"**
  paragraph in chat (themes, converging vs polishing).

## Process notes

- **Design happens in the planning chat.** Major features get a `docs/features/<name>/design.md`
  handoff doc before implementation begins. This repo's
  first epics (web API, web app) come out of a planning session that promotes the brewing
  design doc to "ready for implementation."
