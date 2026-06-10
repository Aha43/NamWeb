# Auth & Security — living spec

> Status: **living document — not a sprint yet.** This captures how auth and security
> work in NamWeb *as built today*, the known risks, and a hardening backlog. Add to it
> as frontend development proceeds (new surfaces, new data, new flows). When it has
> enough weight, it becomes the source for a first **auth/security sprint**.
>
> Nothing here is a commitment to build. It's a baseline + a parking lot.

---

## How to use this doc

- **During dev:** when you add anything that touches identity, tokens, stored data, or a
  new network call, jot the implication here (a line in "Known risks" or "Hardening
  backlog" is enough).
- **At sprint time:** promote a coherent slice of the backlog into GitHub issues, set a
  scope, and update the "Current state" section as items land.

---

## Current state (as built — 2026-06-10, web MVP)

NamWeb is a **single-user, JWT-bearer SPA** talking directly to Supabase. No backend of its
own. (See `docs/features/web-app/design.md` for why direct-to-Supabase.)

**Sign-in flow**
- `src/auth/Login.tsx` → `supabase.auth.signInWithPassword({ email, password })`.
- supabase-js POSTs `…/auth/v1/token?grant_type=password` to GoTrue with the publishable
  key as `apikey`; gets back a **session**: `access_token` (JWT), `refresh_token`, `user`, expiry.
- The **password is never stored** by NamWeb — only typed into the form, then discarded.

**Two credentials per request**
| Header | Value | Purpose |
|---|---|---|
| `apikey` | publishable key (`sb_publishable_…`) | project/gateway identity, anon level. New-format key, **not a JWT**. |
| `Authorization: Bearer …` | user `access_token` (**JWT**, HS256, claims `sub`/`role`/`email`/`exp`) | who you are; the authorization boundary. |

**Authorization (the real enforcement)**
- PostgREST verifies the JWT and exposes `sub` as `auth.uid()` in Postgres.
- RLS on `workspaces` (migration lives in **NamDesktop**): `auth.uid() = owner_user_id` for
  read and write. You can only touch your own row.
- `src/sync/workspaceClient.ts` also filters `owner_user_id = uid` (derived from the local
  session) — belt-and-suspenders; the JWT + RLS is what actually secures it.

**Session lifecycle**
- supabase-js **persists the session in `localStorage`** (default) → survives reload.
- `src/auth/useSession.ts` reads it (`getSession`) and subscribes to `onAuthStateChange`.
- access_token is **short-lived (~1h)**; supabase-js **auto-refreshes** via the refresh_token.
- `App` gates the UI on session presence; `AuthedApp` mounts only when authenticated.

**Relevant files**
- `src/lib/supabase.ts` — client construction from `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
- `src/auth/Login.tsx`, `src/auth/useSession.ts`, `src/App.tsx`, `src/AuthedApp.tsx`.
- `src/sync/workspaceClient.ts` — JWT-bearing data access.

---

## Known risks & limitations (today's baseline)

| # | Risk / limitation | Notes |
|---|---|---|
| R1 | **Tokens in `localStorage`** (access + refresh) | Readable by any XSS. Standard Supabase-SPA tradeoff; acceptable for a single-user personal tool, but it's the biggest lever. |
| R2 | **No Content-Security-Policy / security headers** | Nothing constrains script sources today; raises XSS blast radius (compounds R1). |
| R3 | **Local stack uses shared default secrets** | JWT secret + keys are the Supabase CLI defaults — dev-only, must not reach production. |
| R4 | **No email verification / password reset / MFA** | Login is the only account flow that exists. |
| R5 | **No explicit session-expiry UX** | If refresh fails (revoked/offline), the user sees a load/sync error rather than a clean re-login prompt. |
| R6 | **Single-user assumption baked in** | One account, multiple devices. No tenancy/sharing model. |
| R7 | **No rate limiting / lockout owned by us** | Relies on GoTrue defaults; not reviewed for the hosted target. |
| R8 | **Secrets in `.env` / publishable key in client bundle** | Expected for a SPA (publishable key is meant to be public), but prod config management is undefined. |

No CSRF surface today (auth is `Bearer`-header, not cookies) — that changes if R1's fix introduces cookies (see H1).

---

## Hardening backlog (candidate sprint scope)

Grouped; each is a parking-lot item, not a decision.

**Client token handling**
- **H1 — Move tokens off `localStorage`.** Introduce a thin backend (the deferred web-API
  epic) that sets **httpOnly, Secure, SameSite cookies**; the SPA stops holding the JWT.
  Brings CSRF into scope (mitigate with SameSite + CSRF tokens). Biggest single hardening.
- **H2 — Add a strict CSP** + standard security headers (X-Frame-Options/frame-ancestors,
  Referrer-Policy, etc.) at the hosting layer.
- **H3 — Graceful session expiry**: detect refresh failure / 401 and route to a clean
  re-login instead of a generic error.

**Backend / data**
- **H4 — RLS review & tests**: assert the `workspaces` policy denies cross-user access;
  consider DB-level tests in NamDesktop. Confirm no table is unintentionally readable.
- **H5 — Least-privilege keys** for the hosted target; rotate off CLI defaults (R3).
- **H6 — Audit/trail**: do we want server-side logging of auth events / writes?

**Account lifecycle**
- **H7** — email verification, password reset, change-password, sign-out-everywhere
  (refresh-token revocation).
- **H8** — optional MFA (TOTP) if the data warrants it.

**Operational / supply chain**
- **H9 — Production secrets management** and environment separation (local vs hosted).
- **H10 — Dependency/supply-chain hygiene**: lockfile audit cadence, review of
  `supabase-js` and transitive deps; Dependabot or equivalent.
- **H11 — Abuse controls**: rate limiting / lockout policy for the hosted endpoint.

---

## Cross-repo notes

- The **JWT secret, GoTrue config, and `workspaces` RLS live in NamDesktop** (`supabase/`),
  the single source of truth for the backend contract both clients share. Any RLS/auth
  change is a NamDesktop change that affects both desktop and web.
- The desktop client (`SupabaseSyncService`) uses the **same** GoTrue token flow over
  hand-rolled HTTP; supabase-js just automates token storage/refresh here. Security
  decisions should be evaluated for **both** clients.

## Out of scope (for now)

Multi-tenant/sharing, organizations/roles beyond single-user, SSO/social login, native
mobile auth. Revisit only if the product direction changes.

## Change log

| Date | Change |
|---|---|
| 2026-06-10 | Initial spec — documents the web-MVP auth baseline (JWT-bearer SPA, localStorage session, Supabase RLS) and a first hardening backlog. |
