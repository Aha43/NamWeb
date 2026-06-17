# Development & change-management workflow

> Status: **current model (2026-06-16).** How changes get from a laptop to production now that
> NamWeb is live. Deliberately lightweight for a solo developer. **Not written in stone** — see
> "Evolving this" at the end. Companion to the [topology map](./production-topology.md), the
> [runbooks](./runbooks.md), and the [go-live playbook](./go-live-playbook.md).

## The model: a short line to prod

There are **no dev or staging environments.** A bug or feature is developed and fixed **locally**
(against the **local Supabase stack** run from NamDesktop, `make supabase-start`), then pushed
straight to **production**. One hop.

This is a deliberate trade for a solo project: staging is real overhead (a second Supabase project
to provision, keep config-synced, and double-migrate) and we already have meaningful safety without
it — CI gates, per-PR preview deploys, and one-click rollback. **We don't skip testing; we skip the
extra environment.**

## The core principle: risk is asymmetric

"Push to prod" means two different things with very different danger. **Treat them differently.**

| | Frontend (SPA) deploy | Schema migration |
|---|---|---|
| Mechanism | Merge to `main` → Cloudflare Pages auto-builds → live | `supabase db push` to prod (manual, from a laptop) |
| Reversible? | **Yes** — one-click rollback to the previous Pages deployment | **No** — a bad `DROP`/data migration is permanent |
| Safety net | PR previews + CI + rollback | On free tier: **none** (no PITR backups) |
| Blast radius | NamWeb users | **NamWeb *and* NamDesktop** (shared backend) |
| Stance | **Move fast — it's reversible** | **Slow down — armor it** |

The takeaway: **you can effectively YOLO the frontend** (rollback saves you); **migrations are the
one place to be careful.** Staging's real value was never testing the UI (previews cover that) — it
was rehearsing migrations against a prod-like DB. Since we skip staging, the guardrails live on the
migration path.

## Frontend flow (low-risk, keep it fast)

1. Branch off `main` (feature branch; always tied to a GitHub issue).
2. Develop locally (`npm run dev` against local Supabase). Add/adjust tests.
3. Open a PR. **CI** (`check`, `e2e-mocked`) + GitGuardian must be green; Cloudflare publishes a
   **preview deploy** — click it to verify the change live.
4. Merge to `main` → Pages **auto-deploys** to `usenam.app`.
5. **Post-deploy smoke** (see runbooks). If broken: **roll back** the Pages deployment immediately,
   then revert the merge on `main` so the next deploy doesn't re-ship it, and fix on a branch.

## Schema flow (high-risk, armor it)

Schema lives in **NamDesktop** (`supabase/migrations`, the single source of truth) and is pushed to
prod manually. Rules:

1. **Back up first.** Run a `pg_dump` of prod immediately before any `supabase db push`. This is the
   substitute for staging + PITR — if a migration goes wrong, restore.
2. **Additive / expand-then-contract.** Prefer non-destructive changes: *add* a column/table → ship
   code that uses it → only *later*, in a separate migration, remove the old once nothing references
   it. Never combine a destructive change with the code change in one step.
3. **Review the SQL before it runs.** `supabase db diff` / read the migration; don't push blind.
   Remember prod has **real rows** a fresh local DB doesn't — e.g. a new `UNIQUE`/`NOT NULL`
   constraint can pass locally and **fail on prod data**.
4. **Order matters: migrate prod (additively) *before* deploying the code that needs it.** Never
   ship a build that expects a column prod doesn't have yet.
5. **Mind the shared backend.** A migration affects **both** NamWeb and NamDesktop users — coordinate
   accordingly.

## Universal gates

- **Branch protection on `main`** — require a PR + green CI before merge, so the auto-deploy never
  ships a red build.
- **Post-deploy smoke** — a short checklist after each prod deploy (runbooks).
- **Backups** — scheduled off-platform `pg_dump`, independent of any one migration.

## Evolving this

This model fits *now* — solo, soft-launch-bound, low stakes. It is **not permanent.** As real users
and real data responsibility arrive, graduate toward a more robust setup, e.g.:

- **Migrations in CI** (apply on merge, with review) instead of a manual laptop push.
- Tighter release gates / change review as the team or user base grows.

### Planned: a staging environment (schema-only)

The intended next step is a **staging Supabase project**, with a deliberately narrow scope:

- **Used only for schema/DB changes — not frontend work.** Pure-frontend changes already have a
  pre-prod surface (the **Cloudflare PR preview** *is* "staging for the frontend"). Staging's one
  unique job is **rehearsing migrations against a prod-like database** before they touch prod. So
  the rule becomes: **previews for frontend, staging for schema.**
- **Low overhead because migrations are rare in NAM.** The workspace is a single JSONB document +
  version counter, so almost all product change happens *inside* the document via client-side
  intents (pure frontend, no SQL). Actual migrations are infrequent — which is also exactly why a
  rare migration is *higher*-stakes (no muscle memory, and it's **shared with NamDesktop**), so the
  rehearsal earns its keep precisely when it's needed.
- **Must hold prod-like data to be worth anything.** Staging only beats the empty local stack if it
  has realistic data — the migration bugs we fear are data-shaped (a new `UNIQUE`/`NOT NULL` that
  passes on an empty DB but fails on prod's existing rows). **Seed staging from a sanitized prod
  dump**, or it's just another empty database.
- **Not technically gated by Pro.** Staging is simply a *second* Supabase project (the free tier
  allows two); it can even stay on free while prod is Pro. We tie its *introduction* to the
  go-serious moment for timing, not because Pro unlocks it.

The natural trigger is the same as the **Supabase free → Pro** graduation: *before* the soft launch /
before other people's data is the thing at stake. Revisit this doc then.
