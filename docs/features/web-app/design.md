# Web App — Brewing Document

> Status: **ready for implementation — MVP sprint in progress.** Promoted in the first NamWeb
> planning session (2026-06-10). Decided: full-triage MVP (capture + Next/Backlog + mark
> done/next/backlog), mobile-first responsive online-only, **direct to Supabase** (no web API),
> React + Vite + TypeScript. Key reframe vs the original brewing doc: cloud sync shipped a working
> JSON-blob-over-Supabase contract, so the MVP consumes it directly — the web-API + relational
> schema migration is a **deferred future epic, not a prerequisite**. Sprint tracked as NamWeb
> issues #1–#9.
>
> _(Original framing: brewing doc capturing direction and open questions so the idea ripens.
> Promote only after the cloud-sync API layer is live — which it now is.)_

---

## Why this doc exists now

The cloud-sync design (`docs/features/cloud-sync/design.md`) already placed the web app in the architecture:

```
Desktop app  ──push/pull──▶  Cloud DB  (cloud-sync, #215–217)
                                 │
                          future web API
                           ┌─────┴─────┐
                        Web app    Mobile app
```

There is nothing to implement yet — but the direction is clear enough that early thinking
is worth recording. Decisions made in cloud sync (JSON blob now, relational schema later,
`CloudSyncService` interface as the seam) were made *with* this future in mind. This doc
is the continuation of that thread.

---

## The core idea

The desktop app is the primary, rich interaction surface. It will always be the place for
serious project management: workbench, drag ordering, tags, Mission Control, templates.

The web app is the **ubiquitous companion**: the thing you reach for when you are not at
your main machine — to capture a thought, check what is next, tick something done.

This distinction matters because it shapes scope. The web app does not need to replicate
the workbench. It needs to be fast to open, fast to use, and always in sync.

---

## What the web app probably is

- A lightweight **capture + triage** surface
- **Inbox**: add item, process item (convert to action/project), delete
- **Next Actions**: view the list, mark done, mark backlog
- **Backlog**: view, promote to next
- **Quick add**: one field, capture instantly, sort later
- Works well on a tablet and a phone, not just a desktop browser

## What the web app probably is not

- A replacement for the desktop workbench (project editing, templates, MCR dashboard)
- A multi-user / shared workspace tool (at this stage)
- The next thing to build (cloud sync must come first)

---

## Dependency chain

This cannot be built until the web API exists. The web API does not exist until after
cloud sync (#215–217) ships — the DB schema and sync contract are the foundation.

```
#215–217  cloud sync (Desktop ↔ Cloud DB, JSON blob)
    ↓
web-api epic  (REST API over the DB, domain model in the API layer)
    ↓
web-app epic  (SPA or server-rendered client of the web API)
```

The schema migration from "one JSON blob per workspace" to a relational domain model
(nodes, tags, status) is a prerequisite for the web app to do anything useful. That
migration is the web API's job — the web app is just a client on top of it.

---

## Open product questions

These need answers before real planning can begin. Capture candidate answers as they
emerge — do not force resolution now.

**1. What is the primary device?**
Is this mainly a phone thing (quick capture on the go) or a tablet/laptop browser
thing (real triage session away from the desktop)? The answer changes the UI priorities.

**2. Full sync or read-only with append?**
Option A: Full read/write parity — web app can do everything the desktop can via the API.
Option B: Append-only capture on web, full edits only on desktop.
Option B is far simpler to build and may be the right first step.

**3. Offline / PWA?**
A PWA with a service worker gives mobile app UX without app store friction. Adds
complexity. Probably worth it if phone use is the primary target.

**4. Auth model?**
Single-user (same person, multiple devices) — simple API token or session cookie.
Multi-user is out of scope until there is a reason to expand.

**5. Where does the web API live?**
The cloud sync design chose to talk directly to the DB HTTP API (Turso or Supabase).
The web API could be a thin backend (Next.js API routes, Cloudflare Worker, Hono on
Bun) that wraps the DB. This layer is where you add auth, rate limiting, and the domain
model translation from JSON blob to structured entities.

**6. When does the desktop app switch from direct-DB to API?**
Could stay direct-DB for a long time — the `CloudSyncService` interface already isolates
the change. The web API does not force the desktop to change; the desktop can switch when
convenient.

---

## Technology sketch (not decided)

These are current priors, not commitments. Revisit when the API layer is being planned.

| Concern | Candidate | Why |
|---|---|---|
| Frontend | React + TypeScript | Ecosystem, type safety, component libraries |
| UI library | Radix UI + Tailwind, or shadcn/ui | Accessible, unstyled, composable |
| Backend / API | Hono on Cloudflare Workers, or Next.js API routes | Edge-deployable, zero server ops |
| Auth | Clerk, or API token in local storage | Simple single-user setup |
| Hosting | Vercel or Cloudflare Pages | Free tier, no infra to run |
| State sync | SWR or TanStack Query | Optimistic updates, cache invalidation |
| Repo | Same repo (monorepo `web/`) or separate | Separate is simpler until shared types justify monorepo |

---

## Architecture sketch (future state)

```
NamDesktop (desktop)
    │  CloudSyncService (v2 — talks to web API, not DB directly)
    ▼
NamDesktop Web API  (REST, auth, domain model translation)
    │  reads/writes
    ▼
Cloud DB  (Turso or Supabase — same DB as v1 cloud sync)
    ▲
NamDesktop Web App  (SPA, API client)
    │  (also served from the same API server or separately)
```

The desktop app's `CloudSyncService` v1 talks directly to the DB. v2 will talk to the
web API instead. From the desktop's perspective this is a single line change — the
interface is the seam.

---

## What to do when this gets promoted

When cloud sync (#215–217) is live and the DB schema decision (Turso vs Supabase) is
settled, run a planning session to:

1. Define the web API epic — schema migration, endpoint design, auth
2. Define the web app epic — pages, state management, PWA question
3. Create the GitHub label `web` (or `web-api` + `web-app` separately)
4. Create the issues collection with proper cross-references
5. Update this doc's status from "brewing" to "ready for implementation"

---

## Change log

| Date | Change |
|---|---|
| 2026-06-02 | Initial brewing doc created |
| 2026-06-10 | Cloud sync shipped (NamDesktop PR #352); doc moved to its own NamWeb repo; status → precondition met, awaiting planning session |
