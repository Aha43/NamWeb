# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always present a plan and wait for explicit approval before editing any files or running commands.

## What this repo is

NamWeb is the **web companion** to [NamDesktop](https://github.com/Aha43/NamDesktop) — a
lightweight capture + triage surface you reach for when you are away from your main machine:
add a thought, check what is next, tick something done. The desktop app remains the primary,
rich interaction surface (workbench, drag ordering, Mission Control, templates); NamWeb is
deliberately smaller in scope.

See `docs/features/web-app/design.md` for the product direction, open questions, and the
dependency chain that led here.

## Relationship to NamDesktop and the backend

- NamWeb and NamDesktop are **separate repos** that share **only the Supabase backend HTTP
  contract** — not application code. They evolve on independent cadences.
- The **Supabase migrations are the single source of truth** and live in the **NamDesktop**
  repo (`supabase/`) for now. Do not duplicate schema here. If/when NamWeb starts co-driving
  the schema, we promote the migrations to a dedicated backend repo — not before.
- NamWeb is a **client** of the same Supabase project the desktop cloud-sync feature uses.

## Tech stack

Decided in the first planning session (see `docs/features/web-app/design.md`):

- **React + TypeScript** on **Vite** (mobile-first responsive SPA, online-only for the MVP).
- **`@supabase/supabase-js`** — talks **directly** to the same Supabase project as NamDesktop
  cloud sync. No web API of our own; the web-API + relational schema is a deferred future epic.
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
target the local Supabase stack run from NamDesktop (`make supabase-start`).

`npm run test` is this repo's equivalent of NamDesktop's `make test`; `npm run dev` of `make run`.

## Workflow

- **Always work on a GitHub issue.** Never start implementation without a corresponding issue —
  either one created upfront or one we create together before coding begins.
  Include `Closes #<number>` in every non-chore commit.
- **Always check the current branch before committing.** If on `main`, warn and stop.
  All feature work must go on a feature branch.
- **Default feature branch name is `feature/next`.** Rename it to something descriptive
  before opening a PR.
- When completing a GitHub issue, update the `## [Unreleased]` section of `CHANGELOG.md`
  before committing. Use `Added`, `Changed`, or `Fixed` as appropriate, and include
  `Closes #<number>` in the commit message.
- **One issue at a time.** After completing an issue, stop and wait for the user to confirm
  before starting the next one — even when multiple issues are planned for the same sprint.
  (**Exception: auto-sprint mode** — see "Auto-sprints" below, where the whole agreed set runs
  straight through without per-issue pauses.)

### Delivery: ship a PR with a Cloudflare preview link

Once a feature is built and **locally green** (typecheck, lint, full unit suite, and the relevant
mocked e2e journey all pass), **deliver it for review automatically — do not pause to ask "want me
to commit?":**

1. Commit (`Closes #<number>` + the standard co-author line).
2. Push the feature branch and open the PR.
3. Fetch the **Cloudflare Pages branch-preview URL** and post it. It lives in the PR's
   "Cloudflare Pages" check output — read it with
   `gh api repos/Aha43/NamWeb/commits/<sha>/check-runs --jq '.check_runs[] | select(.name=="Cloudflare Pages") | .output.summary'`
   and surface the `*.namweb.pages.dev` **Branch Preview URL** (it tracks the latest push; the
   per-commit hash URL is frozen to one build).
4. **Pause for the user to test on the preview.** Merge only when they explicitly say so
   (`gh pr merge <#> --squash --delete-branch`) — merge is the one step that still needs a go-ahead.

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
5. Each PR follows the **Delivery** loop above: locally green → commit → push → PR with **how to
   test** + the **Cloudflare branch-preview link**.
6. **Never merge during the sprint.** The deliverable is N PRs (each with test notes + a CF link)
   left open for the user. Merge only after they've tested — or explicitly said a PR can be merged.

### Definition of Done for feature issues

A feature issue is complete when:
- the feature works (verified by running it; for UI, on the Cloudflare PR preview)
- relevant tests are added or updated
- all existing tests pass
- no obvious domain invariant is weakened

## Process notes

- **Design happens in the planning chat.** Major features get a `docs/features/<name>/design.md`
  handoff doc before implementation begins, mirroring the NamDesktop practice. This repo's
  first epics (web API, web app) come out of a planning session that promotes the brewing
  design doc to "ready for implementation."
