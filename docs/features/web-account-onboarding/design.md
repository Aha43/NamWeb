# Web account onboarding — design

> Status: **draft / for design review.** Planning only — no implementation has started.
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

## Open questions (to settle before/within implementation)
- **Account-deletion semantics** — cloud-everywhere vs web-only; fate of local desktop data; grace
  period / soft-delete vs hard-delete.
- **Does NamDesktop honor entitlements**, or stay all-features?
- **Email sender (SMTP)** for production verification/reset mail — which provider.
- **Bot protection** choice (Turnstile vs hCaptcha vs none-at-MVP).
- **Where sign-up surfaces** — SPA only, or also a hook from the MCP connector's login page (so a
  brand-new connector user isn't dead-ended)? At minimum the connector login page should *link* to
  web sign-up.
- **Social-login timing** — MVP+1, or fold Google in at MVP since Supabase makes it cheap.
- **Invites** — do we track an invite token (for attribution / future referral rewards) or just send a
  plain sign-up link? Per-user cap and whether invites need the inviter's email verified first.
- **Account surface shape** — Account as a routed page vs a dialog/panel; and whether Account folds
  into the existing Settings dialog (`#104`) with tabs or stays a separate top-right menu entry.

## Phasing (rough — refine at review)
- **P0** — email+password sign-up + email verification + sign-in; password reset; the `can(feature)` /
  entitlements seam defaulting to `free`. SPA surfaces; abuse controls (rate-limit + captcha).
- **P1** — account deletion (privileged server action) with the agreed semantics; **invites** (reuses
  the P0 email path; add per-user caps).
- **P2** — social login (Google) once email/password is solid.
- **Later** — concrete plans + billing, *if/when* there's an actual monetization decision.

## Process note
This doc is the handoff, mirroring the repo's design-doc practice. It is **not approved for
implementation** — it captures direction + the open questions so the account model is ironed out on
paper (and in memory) rather than only in chat. Resume by settling the open questions above.
