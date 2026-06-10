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

### Definition of Done for feature issues

A feature issue is complete when:
- the feature works (verified by running it)
- relevant tests are added or updated
- all existing tests pass
- no obvious domain invariant is weakened

## Process notes

- **Design happens in the planning chat.** Major features get a `docs/features/<name>/design.md`
  handoff doc before implementation begins, mirroring the NamDesktop practice. This repo's
  first epics (web API, web app) come out of a planning session that promotes the brewing
  design doc to "ready for implementation."
