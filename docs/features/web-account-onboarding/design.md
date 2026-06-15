# Web account onboarding — design

> Status: **P0 scope settled (2026-06-15); ready to implement.** See *Decisions settled* below.
> Promotes a topic that surfaced while finishing the remote-MCP epic (see
> [`../remote-mcp/design.md`](../remote-mcp/design.md)).

## Why this exists

NamWeb has **no account creation today** — `src/auth/Login.tsx` only does
`supabase.auth.signInWithPassword`. Every user must already have a Supabase account, created
out-of-band (NamDesktop cloud-sync setup, or the Supabase dashboard).

That was fine while NamWeb read as a "companion to NamDesktop." It no longer holds: **NamWeb is the
primary, user-facing product** — most people will live in the web app daily and never touch the
desktop. (NamDesktop remains the concept lab — "try it on desktop first, and if it's cool it also
goes to web" — and a power-user sidekick, but that's a *development* rule, not the product vision.)

A mass-market web product cannot gate account creation behind a nerdy desktop app. So **NamWeb needs
its own public, self-serve account onboarding.** This is broader than any one feature; the remote-MCP
connector, for instance, simply consumes whatever account model NamWeb has.

## Scope

### In (MVP)
- **Self-serve sign-up** — email + password.
- **Email verification** on sign-up (no usable account until confirmed).
- **Password reset** / forgot-password.
- **"Email already registered"** handled gracefully → route to sign-in / reset, never a dead end.
- **Account deletion** — the user can delete their account (semantics below — needs settling).
- **Invites** — a signed-in user can send an invite email to a friend ("here, try Nam"), straight
  from the app. A low-friction growth hook for the early "friends are looking" phase. The invite mail
  carries a sign-up link (optionally with an invite token, so we can attribute / pre-fill the email);
  it reuses the same transactional-email path as verification/reset. *Lightweight — can slip to P1.*
- **Abuse controls** appropriate to a public, write-capable surface (see Security).

### Provisioned for, **not** built
- **Subscription plans + per-plan feature switching.** *There is no concrete monetization plan and no
  specific tier in mind* — this is provisioned only because it's a cheap seam to leave open and a
  plausible "nice to have" later. We model **entitlements** now and gate features through one seam, so
  adding plans/billing later is wiring, not surgery. Default everyone to a single `free` entitlement.
- **Social login** (Google, …) — wanted *later*; email+password first. Supabase makes this a provider
  toggle + a button, so the sign-in UI should leave room for provider buttons.

### Out
- Billing / payment integration (Stripe etc.).
- Teams / orgs / multi-user workspaces.
- SSO / enterprise.

## Account surface (where it lives in the UI)

All account *view/change* lives behind a **user-icon menu** in the top-right (avatar / initials).
Clicking it opens a small menu → **Account**, **Settings**, **Sign out** (sign-out already lives
top-right today; this generalises it into a proper account menu).

The **Account page** is the single home for everything identity/security:
- profile (display name, email),
- change password,
- connected social logins (when added),
- **invites** (send one, see pending),
- **delete account**,
- and — *only if it ever exists* — plan / billing.

**Relationship to the existing Settings dialog** (`#104`, the date-format preference): decide whether
Account and app Settings are one surface with tabs or two menu entries. Sensible split — **Settings =
app/display preferences; Account = identity, security, invites, deletion** — but that's an open
question (below).

## Approach — lean on Supabase Auth

Supabase Auth already provides the primitives, so this is mostly **UX + wiring + policy**, not
building auth:

- `supabase.auth.signUp({ email, password })` + **email confirmation** (Supabase sends the mail;
  needs an SMTP sender configured for production — the built-in is rate-limited and dev-only).
- `resetPasswordForEmail` + the update-password redirect flow.
- `signInWithOAuth({ provider })` for social login when we add it (project-level provider config).
- Account deletion: there is **no client-side delete**; it needs the **service role** (admin API) or a
  Postgres RPC/Edge Function the user invokes — i.e. a small privileged server action, like the MCP
  server's service-level plane.

### Entitlements seam (the "plan provision")
- An `entitlements` notion attached to the account (a `profiles`/`account` row, default `free`).
- A single `can(feature)` check in the app; feature gates call **that**, never scattered `if`s.
- Later: introduce named plans + a billing provider and flip the data — **zero feature call-site
  refactor.** Mirrors the MCP epic's `AuthStore` / `OAuthServerProvider` seam philosophy.

## Security (public sign-up + a write-capable API = a target)
- **Email verification required** before the account can do anything.
- **Rate-limit** sign-up + sign-in + reset (the MCP server already has a per-IP limiter pattern to reuse).
- **Bot protection** on sign-up (CAPTCHA / Turnstile — Supabase Auth supports a captcha hook).
- Standard hygiene: no user-enumeration leaks ("email already registered" should not differ
  observably from success in timing/wording where it matters), strong-ish password policy.
- **Invites are a spam vector** — they send mail to arbitrary addresses on a user's behalf. Cap +
  rate-limit invites per user, send from a verified domain, and don't leak whether the invited address
  is already a Nam user.
- ToS / privacy acceptance at sign-up (product/legal, not just technical).

## Impact on NamDesktop

NamWeb and NamDesktop share **one Supabase project**, so this is mostly **additive** but genuinely
touches desktop in a few places:

1. **Schema is NamDesktop's source of truth.** Any new `profiles` / `entitlements` (and later `plans`)
   tables are **migrations in the NamDesktop repo**, applied there and consumed here — same cross-repo
   pattern as the Realtime publication migration. Coordinate, don't duplicate.
2. **Account deletion is shared.** Deleting an account removes the single `auth.users` identity, and
   `workspaces.owner_user_id` references it — so "delete my account" on the web removes the cloud data
   **desktop syncs to** for that user. Define the contract: nuke-cloud-everywhere vs. revoke-web-only;
   what happens to the user's *local* desktop data (untouched, presumably). **(Open question.)**
3. **Unified identity is a feature.** Same email = same account on both surfaces. Web becoming the
   primary sign-up path means desktop users and web users converge on one identity — intended, but
   make it explicit (e.g. a desktop user who later "signs up" on web is the *same* account, via
   sign-in/reset, not a duplicate).
4. **Do plans gate desktop?** If features become entitlement-gated, decide whether the desktop
   power-tool honors entitlements or is all-features. **(Open question — product call.)**
5. **Unaffected:** the core `workspaces` sync contract (one JSONB doc + version) is untouched; desktop
   cloud sync keeps working exactly as today.

## Decisions settled (2026-06-15)
- **Account deletion** — **hard delete behind a strong confirm** (no soft-delete / grace period for
  MVP). Before deleting, offer a one-click **JSON export** of the user's data ("download a copy
  first"); also expose **Export my data** *anytime* on the account page. Export is near-free — a
  workspace is already a JSON document — and deletion + export are the data-portability pair. Local
  desktop files on disk are untouched; cloud data is removed, so that account's desktop *cloud sync*
  empties.
- **Account surface** — a single **routed Settings/Account page** reached from a **top-right user-icon
  menu** (menu: *Account · Settings · Sign out*), organised in **tabs**: *Account* (identity, security,
  data, delete) · *Preferences* (date format, …) · later *Billing*. The existing date-format **dialog
  (`#104`) migrates** into the Preferences tab.
- **Invites** — MVP is **dead-simple: a plain sign-up link, no tracking**. Guards only: **verified
  users** can invite, plus a **per-user cap + rate-limit**. Tracked-token attribution, a pending-invites
  list, and referral rewards are a clearly-flagged **later** add (provisioned in spirit, not built).
- **Entitlements & desktop** — **deferred.** Entitlements default to `free` = everything (no gating
  exists yet), so **NamDesktop is unaffected** and stays all-features by default; revisit only if real
  plans ever appear.

## Still open (not MVP blockers — local Inbucket covers email in dev)
- **SMTP sender** for production verification / reset / invite mail — pick at public-launch time (local
  dev uses **Inbucket**, http://127.0.0.1:54324).
- **Bot protection** (Turnstile / hCaptcha) — add at public launch; off for local dev.
- **Social-login timing** — P2, after email/password is solid.
- **Sign-up entry points** — proposed default: the **SPA is the primary** sign-up surface, and the MCP
  connector login page **links out** to web sign-up so a brand-new connector user isn't dead-ended.
  (Confirm at build.)

## Phasing
- **P0** — email+password **sign-up + email verification + sign-in**; **password reset**; the
  `can(feature)` / entitlements seam defaulting to `free`; the **Settings/Account page shell**
  (user-icon menu + tabs) with the `#104` preferences migrated in; **Export my data** (JSON). All
  testable on the local stack (Supabase Auth + Inbucket).
- **P1** — **account deletion** (privileged server action — service role / RPC / Edge Function) behind
  the confirm + export nudge; **invites** (plain link, verified-only, capped).
- **P2** — social login (Google).
- **Later** — concrete plans + billing, *if/when* there's a real monetization decision.

## Process note
Direction and the P0 open questions are **settled** (2026-06-15) — see *Decisions settled* above. The
doc is ready to become an epic + a concrete P0 build plan; the whole MVP is **local-stack testable**
(Supabase Auth + the Inbucket email catcher). The remaining *Still open* items are launch-time / infra,
not MVP blockers.
